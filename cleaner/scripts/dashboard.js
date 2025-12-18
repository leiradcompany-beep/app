$(document).ready(function () {
    loadDashboardData();
});

// Load DashboardData
function loadDashboardData() {
    // Set Date
    const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
    $('#current-date').text(new Date().toLocaleDateString('en-US', dateOptions));

    // Fetch Stats and Jobs
    ApiClient.get('/cleaner/dashboard')
        .then(function (response) {
            if (response.success) {
                // Calculate total pending jobs (assigned + confirmed + pending)
                // Assuming response.data.jobs contains the list of jobs with their statuses
                // and response.data.pending_assignments contains new assignments (status 'assigned')

                let pendingCount = 0;

                // Count from new assignments (usually status 'assigned')
                if (response.data.pending_assignments) {
                    pendingCount += response.data.pending_assignments.length;
                }

                // Count from jobs list (confirmed, pending, etc - excluding completed/cancelled/declined)
                if (response.data.jobs) {
                    const activeStatuses = ['confirmed', 'pending', 'assigned'];
                    // Note: 'assigned' might duplicate if it's in both lists, but usually they are separate or handled.
                    // Let's assume 'pending_assignments' are separate 'new' requests.
                    // And 'jobs' list contains scheduled jobs.
                    // We filter 'jobs' for active ones.

                    const activeJobs = response.data.jobs.filter(job =>
                        activeStatuses.includes(job.raw_status) || activeStatuses.includes(job.status.toLowerCase())
                    );
                    pendingCount += activeJobs.length;

                    // Deduplicate if necessary? 
                    // Usually pending_assignments (new offers) are not in the main 'jobs' list until accepted?
                    // Or they are in both. 
                    // To be safe, let's count unique IDs if possible.

                    const allJobIds = new Set();
                    if (response.data.pending_assignments) {
                        response.data.pending_assignments.forEach(j => allJobIds.add(j.id));
                    }
                    if (response.data.jobs) {
                        response.data.jobs.forEach(j => {
                            const s = j.raw_status || j.status.toLowerCase();
                            if (activeStatuses.includes(s)) {
                                allJobIds.add(j.id);
                            }
                        });
                    }
                    pendingCount = allJobIds.size;
                }

                // Pass calculated count to updateStats
                updateStats(response.data.stats, pendingCount);

                // Fix Data Inconsistency: Sync image from jobs list to next_job if missing
                let nextJob = response.data.next_job;
                const jobsList = response.data.jobs || [];

                if (nextJob && (!nextJob.customer_img || nextJob.customer_img === 'null')) {
                    // Try to find matching job in list
                    const match = jobsList.find(j =>
                        j.service === nextJob.service &&
                        (j.customer === nextJob.customer_name || j.customer.includes(nextJob.customer_name))
                    );

                    if (match && match.customer_img) {
                        nextJob.customer_img = match.customer_img;
                    }
                }

                updateNextJob(nextJob);
                renderAssignmentRequests(response.data.pending_assignments);
                renderPendingJobs(jobsList); // Top 5/10 jobs
            }
        })
        .catch(function (xhr) {
            console.error('Failed to load dashboard data', xhr);
            UiUtils.showToast('Failed to load data', 'error');
        });
}

const SERVER_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8000'
    : 'https://itsolutions.muccsbblock1.com/cleaning_services/public';

function renderAssignmentRequests(requests) {
    const area = $('#assignmentRequestsArea');
    const list = $('#assignmentRequestsList');
    list.empty();

    if (!requests || requests.length === 0) {
        area.hide();
        return;
    }

    area.show();

    requests.forEach(req => {
        let customerImg = req.customer_img || '../../assets/images/default-avatar.png';
        if (req.customer_img && !req.customer_img.startsWith('http') && !req.customer_img.startsWith('data:')) {
            if (req.customer_img.startsWith('/storage/')) {
                customerImg = new URL(req.customer_img, SERVER_URL).href;
            } else if (!req.customer_img.startsWith('../../')) {
                customerImg = '../../' + req.customer_img;
            }
        }
        if (typeof customerImg === 'string' && customerImg.trim().toLowerCase().includes('ui-avatars.com')) {
            customerImg = '../../assets/images/default-avatar.png';
        }

        const item = `
            <div class="assignment-card">
                <div class="d-flex gap-4 align-items-center flex-grow-1">
                    <!-- Customer Image -->
                    <div style="position: relative;">
                        <img src="${customerImg}" 
                             onerror="this.src='../../assets/images/default-avatar.png'"
                             style="width: 60px; height: 60px; border-radius: 16px; object-fit: cover; border: 2px solid #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    </div>
                    
                    <div class="d-flex flex-column gap-1">
                        <h5 class="mb-1 fw-bold" style="font-size: 1.1rem; color: var(--text-dark);">${req.service}</h5>
                        
                        <!-- Location & Date -->
                        <div class="d-flex flex-wrap gap-3">
                            <span class="small d-flex align-items-center gap-1" style="color: var(--text-body); font-weight: 500;">
                                <i class="ri-calendar-line" style="color: var(--primary);"></i> ${req.date}
                            </span>
                            <span class="small d-flex align-items-center gap-1" style="color: var(--text-body); font-weight: 500;">
                                <i class="ri-map-pin-line" style="color: var(--danger);"></i> ${req.location}
                            </span>
                        </div>
                        
                        <!-- Price Badge -->
                        <div class="mt-2">
                            <span style="background: var(--primary-light); color: var(--primary-dark); border: 1px solid var(--primary); padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                                <i class="ri-money-dollar-circle-line"></i> ${req.price}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="d-flex flex-column gap-2 align-items-end" style="min-width: 120px;">
                    <button onclick="acceptAssignment('${req.id}')" 
                            class="btn-action-soft accept" style="width: 100%; justify-content: center;">
                        <i class="ri-check-line"></i> Accept
                    </button>
                    <button onclick="rejectAssignment('${req.id}')" 
                            class="btn-action-soft reject" style="width: 100%; justify-content: center;">
                        <i class="ri-close-line"></i> Reject
                    </button>
                </div>
            </div>
        `;
        list.append(item);
    });
}

let currentJobId = null;

window.acceptAssignment = function (id) {
    currentJobId = id;
    const modal = document.getElementById('accept-modal');
    if (modal) {
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
};

window.rejectAssignment = function (id) {
    currentJobId = id;
    const modal = document.getElementById('reject-modal');
    if (modal) {
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
};

function closeAcceptModal() {
    const modal = document.getElementById('accept-modal');
    if (modal) {
        modal.classList.remove('open');
        document.body.style.overflow = 'auto';
    }
    currentJobId = null;
}

function closeRejectModal() {
    const modal = document.getElementById('reject-modal');
    if (modal) {
        modal.classList.remove('open');
        document.body.style.overflow = 'auto';
    }
    currentJobId = null;
}

// Setup Modal Actions
$(document).ready(function () {
    $('#confirmAcceptBtn').on('click', function () {
        if (currentJobId) {
            const btn = $(this);
            UiUtils.setBtnLoading(btn, true, 'Accepting...');
            updateJobStatus(currentJobId, 'confirmed', btn, 'Yes, Accept');
        }
    });

    $('#confirmRejectBtn').on('click', function () {
        if (currentJobId) {
            const btn = $(this);
            UiUtils.setBtnLoading(btn, true, 'Rejecting...');
            updateJobStatus(currentJobId, 'declined', btn, 'Yes, Reject');
        }
    });

    // Close Modals on Outside Click
    $('#accept-modal').on('click', function (e) {
        if (e.target === this) closeAcceptModal();
    });
    $('#reject-modal').on('click', function (e) {
        if (e.target === this) closeRejectModal();
    });
});

function updateJobStatus(id, status, btn, originalText) {
    ApiClient.post(`/cleaner/jobs/${id}/status`, { status: status })
        .then(function (response) {
            if (response.success) {
                let msg = 'Status updated successfully';
                if (status === 'confirmed') {
                    const count = response.auto_rejections?.count || 0;
                    const nums = (response.auto_rejections?.numbers || []).join(', ');
                    msg = count > 0
                        ? `Accepted. Auto-rejected ${count} overlapping assignment(s): ${nums}`
                        : 'Accepted assignment';
                } else if (status === 'declined') {
                    msg = 'Assignment declined';
                } else if (status === 'in_progress') {
                    msg = 'Job started';
                } else if (status === 'completed') {
                    msg = 'Job completed';
                }
                UiUtils.showToast(msg, 'success');
                loadDashboardData();
                if (status === 'confirmed') closeAcceptModal();
                else if (status === 'declined') closeRejectModal();
            } else {
                UiUtils.showToast(response.message || 'Failed to update status', 'error');
            }
        })
        .catch(function (xhr) {
            let msg = 'Error updating status';
            if (xhr && xhr.responseJSON && xhr.responseJSON.message) {
                msg = xhr.responseJSON.message;
            }
            UiUtils.showToast(msg, 'error');
        })
        .finally(function () {
            if (btn) UiUtils.setBtnLoading(btn, false, originalText);
        });
}

function updateStats(stats, pendingCount) {
    if (!stats) return;

    // Use the calculated pending count
    $('#statPending').text(pendingCount !== undefined ? pendingCount : 0);

    $('#statCompleted').text(stats.jobs_completed);
    $('#statRating').text(stats.rating);
}


function updateNextJob(job) {
    if (!job) {
        $('.job-hero').hide();
        return;
    }
    $('.job-hero').fadeIn(); // Use fadeIn for smoother transition

    // Update Header Info
    $('#nextJobTime').text(job.time);
    $('#nextJobService').text(job.service);

    // Update Address (remove icon from string if previously added via JS, though we changed HTML structure now)
    // The new HTML structure expects just the text in #nextJobAddress
    $('#nextJobAddress').text(job.address);

    // Update Customer Name
    $('#nextJobCustomer').text(job.customer_name);

    // Handle Customer Image
    let customerImg = job.customer_img;
    if (!customerImg || customerImg === 'null' || customerImg.trim() === '') {
        customerImg = '../../assets/images/default-avatar.png';
    } else if (!customerImg.startsWith('http') && !customerImg.startsWith('data:')) {
        if (customerImg.startsWith('/storage/')) {
            customerImg = new URL(customerImg, SERVER_URL).href;
        } else if (!customerImg.startsWith('../../')) {
            customerImg = '../../' + customerImg;
        }
    }
    if (typeof customerImg === 'string' && customerImg.trim().toLowerCase().includes('ui-avatars.com')) {
        customerImg = '../../assets/images/default-avatar.png';
    }

    $('#nextJobCustomerImg')
        .attr('src', customerImg)
        .off('error')
        .on('error', function(){ this.src='../../assets/images/default-avatar.png'; })
        .show();

    // Handle Service Background Image
    let serviceImg = job.service_img;
    if (serviceImg && serviceImg !== 'null' && serviceImg.trim() !== '') {
        if (!serviceImg.startsWith('http') && !serviceImg.startsWith('data:')) {
            if (serviceImg.startsWith('/storage/')) {
                serviceImg = new URL(serviceImg, SERVER_URL).href;
            } else if (!serviceImg.startsWith('../../')) {
                serviceImg = '../../' + serviceImg;
            }
        }
        $('#nextJobServiceImg').css('background-image', `url('${serviceImg}')`);
    } else {
        $('#nextJobServiceImg').css('background-image', 'none');
    }
}

function renderPendingJobs(jobs) {
    const container = $('#pendingJobsBody');
    container.empty();

    if (!jobs || jobs.length === 0) {
        container.html('<tr><td colspan="4" class="text-center py-4 text-muted">No jobs available.</td></tr>');
        return;
    }

    // Filter for 'assigned' and 'confirmed' statuses ONLY
    const activeJobs = jobs.filter(job => {
        const s = (job.raw_status || job.status || '').toLowerCase();
        return s === 'assigned' || s === 'confirmed';
    });

    if (activeJobs.length === 0) {
        container.html('<tr><td colspan="4" class="text-center py-4 text-muted">No active jobs (Assigned or Confirmed).</td></tr>');
        return;
    }

    // Sort by date (ascending - upcoming first) and take top 5
    const sortedJobs = activeJobs.sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedJobs.slice(0, 5).forEach(job => {
        let statusClass = 'status-pending';
        const rawStatus = (job.raw_status || '').toLowerCase();

        if (rawStatus === 'confirmed') statusClass = 'status-confirmed';
        else if (rawStatus === 'assigned') statusClass = 'status-pending'; // Visual style for assigned

        let customerImg = job.customer_img;
        if (!customerImg || customerImg === 'null' || customerImg.trim() === '') {
            customerImg = '../../assets/images/default-avatar.png';
        } else if (!customerImg.startsWith('http') && !customerImg.startsWith('data:')) {
            if (customerImg.startsWith('/storage/')) {
                customerImg = new URL(customerImg, SERVER_URL).href;
            } else if (!customerImg.startsWith('../../')) {
                customerImg = '../../' + customerImg;
            }
        }
        if (typeof customerImg === 'string' && customerImg.trim().toLowerCase().includes('ui-avatars.com')) {
            customerImg = '../../assets/images/default-avatar.png';
        }
        if (typeof customerImg === 'string' && customerImg.trim().toLowerCase().includes('ui-avatars.com')) {
            customerImg = '../../assets/images/default-avatar.png';
        }

        let serviceImg = job.service_img;
        if (!serviceImg || serviceImg === 'null' || serviceImg.trim() === '') {
            serviceImg = '../../assets/images/default-service.png';
        } else if (!serviceImg.startsWith('http') && !serviceImg.startsWith('data:')) {
            if (serviceImg.startsWith('/storage/')) {
                serviceImg = new URL(serviceImg, SERVER_URL).href;
            } else if (!serviceImg.startsWith('../../')) {
                serviceImg = '../../' + serviceImg;
            }
        }

        const row = `
            <tr>
                <td class="align-middle" data-label="Date"><span class="fw-bold text-dark">${job.date}</span></td>
                <td class="align-middle" data-label="Service">
                    <div class="d-flex align-items-center gap-3">
                        <img src="${serviceImg}" class="rounded shadow-sm" 
                             onerror="this.src='../../assets/images/default-service.png'"
                             style="width:40px; height:40px; object-fit:cover;">
                        <span class="fw-semibold text-dark">${job.service}</span>
                    </div>
                </td>
                <td class="align-middle" data-label="Customer">
                    <div class="d-flex align-items-center gap-2">
                        <img src="${customerImg}" class="rounded-circle border" 
                             onerror="this.src='../../assets/images/default-avatar.png'"
                             style="width:30px; height:30px; object-fit:cover;">
                        <span>${job.customer}</span>
                    </div>
                </td>
                <td class="align-middle" data-label="Status"><span class="status-badge ${statusClass}">${job.status}</span></td>
            </tr>
        `;
        container.append(row);
    });
}
