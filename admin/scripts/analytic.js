// Admin Analytics Management
// Handles chart initialization and data fetching

// API_BASE_URL handled by ApiClient

// Chart Instances
let revenueChartInst = null;
let categoryChartInst = null;
let cleanerChartInst = null;
let clientChartInst = null;

$(document).ready(function() {
    checkAuth();
    setupEventListeners();
    loadAnalyticsData();
});

function checkAuth() {
    if (!localStorage.getItem('auth_token')) {
         // window.location.href = '../auth/index.html'; // Uncomment if auth is enforced
    }
}

function setupEventListeners() {
    // Sidebar Toggle handled by admin-sidebar.js
    
    // Window Resize logic can be kept if needed, but admin-sidebar.js might handle basic responsive toggle
    // Keeping it for specific chart resizing safety if needed
    $(window).resize(function() {
        if ($(window).width() > 992) {
            $('#sidebar').removeClass('open mobile-active');
            $('#dashboard').removeClass('collapsed');
            $('#overlay').removeClass('active');
            $('#mobileOverlay').removeClass('active');
        }
    });
}
/*
function toggleSidebar() {
    if ($(window).width() <= 992) {
        toggleDrawer();
    } else {
        $('#sidebar').toggleClass('collapsed');
        $('#dashboard').toggleClass('sidebar-collapsed');
    }
}

function toggleDrawer() {
    $('#sidebar').toggleClass('open');
    $('#overlay').toggleClass('active');
}

function closeDrawer() {
    $('#sidebar').removeClass('open');
    $('#overlay').removeClass('active');
}
*/

function loadAnalyticsData() {
    ApiClient.get('/admin/analytics')
        .then(function(response) {
            if (response.success) {
                renderAnalytics(response.data);
            } else {
                showError('Failed to load analytics data');
            }
        })
        .catch(function(xhr) {
            console.error('API fetch failed', xhr);
            showError('Error loading analytics');
        });
}

function showError(msg) {
    UiUtils.showToast(msg, 'error');
}


function renderAnalytics(data) {
    renderKPIs(data.kpi);
    initCharts(data.charts);
}

function renderKPIs(kpi) {
    // Update values
    $('#totalRevenue').text('₱' + kpi.revenue.toLocaleString());
    $('#totalJobs').text(kpi.jobs);
    $('#avgOrder').text('₱' + kpi.avgOrder.toFixed(2));
    $('#cleanerAvail').text(kpi.availability + '%');

    // Update Trends
    updateTrend('#revenueTrend', kpi.revenueTrend);
    updateTrend('#jobsTrend', kpi.jobsTrend);
    updateTrend('#orderTrend', kpi.avgOrderTrend);
    updateTrend('#availTrend', kpi.availabilityTrend);
}

function updateTrend(selector, value) {
    const element = $(selector);
    element.removeClass('up down');
    element.find('i').removeClass('ri-arrow-up-line ri-arrow-down-line');
    
    if (value >= 0) {
        element.addClass('up');
        element.html(`<i class="ri-arrow-up-line"></i> +${value}% vs last month`);
    } else {
        element.addClass('down');
        element.html(`<i class="ri-arrow-down-line"></i> ${value}% vs last month`);
    }
}

function initCharts(chartsData) {
    // Revenue Chart (Line)
    const ctxRev = document.getElementById('revenueChart').getContext('2d');
    if (revenueChartInst) revenueChartInst.destroy();
    
    // Create Gradient
    let gradient = ctxRev.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(44, 122, 123, 0.2)');
    gradient.addColorStop(1, 'rgba(44, 122, 123, 0)');

    revenueChartInst = new Chart(ctxRev, {
        type: 'line',
        data: {
            labels: chartsData.revenue.labels,
            datasets: [{
                label: 'Revenue (₱)',
                data: chartsData.revenue.data,
                borderColor: '#2C7A7B',
                backgroundColor: gradient,
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#2C7A7B',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#1A202C',
                    bodyColor: '#2C7A7B',
                    borderColor: '#E2E8F0',
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { borderDash: [4, 4], color: '#E2E8F0' },
                    ticks: {
                        font: { family: "'Manrope', sans-serif", size: 11 },
                        color: '#718096',
                        callback: function(value) {
                            return '₱' + value;
                        }
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { family: "'Manrope', sans-serif", size: 11 },
                        color: '#718096'
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });

    // Categories Chart (Doughnut)
    const ctxCat = document.getElementById('categoryChart').getContext('2d');
    if (categoryChartInst) categoryChartInst.destroy();

    // Center Text Plugin
    const centerTextPlugin = {
        id: 'centerText',
        beforeDraw: function(chart) {
            const { ctx, width, height } = chart;
            ctx.save();
            
            // Calculate Total
            const total = chart.config.data.datasets[0].data.reduce((a, b) => a + b, 0);
            
            // Center Coordinates (based on chart area, not canvas)
            const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
            const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Draw Number
            ctx.font = '800 1.8rem "Manrope", sans-serif';
            ctx.fillStyle = '#234E52'; // primary-dark
            ctx.fillText(total, centerX, centerY - 10);
            
            // Draw Label
            ctx.font = '600 0.85rem "Manrope", sans-serif';
            ctx.fillStyle = '#718096'; // text-light
            ctx.fillText('Total Jobs', centerX, centerY + 15);
            
            ctx.restore();
        }
    };

    categoryChartInst = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
            labels: chartsData.categories.labels,
            datasets: [{
                data: chartsData.categories.data,
                backgroundColor: ['#2C7A7B', '#38B2AC', '#81E6D9', '#E6FFFA'],
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%', // Thinner ring
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { 
                        boxWidth: 10, 
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            family: "'Manrope', sans-serif",
                            size: 11
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#1A202C',
                    bodyColor: '#4A5568',
                    borderColor: '#E2E8F0',
                    borderWidth: 1,
                    padding: 10,
                    boxPadding: 4
                }
            },
            layout: {
                padding: 10
            }
        },
        plugins: [centerTextPlugin]
    });

    // Cleaner Performance (Bar)
    const ctxCleaner = document.getElementById('cleanerChart').getContext('2d');
    if (cleanerChartInst) cleanerChartInst.destroy();

    cleanerChartInst = new Chart(ctxCleaner, {
        type: 'bar',
        data: {
            labels: chartsData.cleaners.labels,
            datasets: [{
                label: 'Jobs Completed',
                data: chartsData.cleaners.data,
                backgroundColor: '#38B2AC',
                borderRadius: 4,
                barThickness: 30
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#1A202C',
                    bodyColor: '#4A5568',
                    borderColor: '#E2E8F0',
                    borderWidth: 1,
                    padding: 10
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { borderDash: [4, 4], color: '#E2E8F0' },
                    ticks: {
                        font: { family: "'Manrope', sans-serif", size: 11 },
                        color: '#718096'
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { family: "'Manrope', sans-serif", size: 11 },
                        color: '#718096'
                    }
                }
            }
        }
    });

    // Client Retention (Pie)
    const ctxClient = document.getElementById('clientChart').getContext('2d');
    if (clientChartInst) clientChartInst.destroy();

    clientChartInst = new Chart(ctxClient, {
        type: 'pie',
        data: {
            labels: chartsData.retention.labels,
            datasets: [{
                data: chartsData.retention.data,
                backgroundColor: ['#2C7A7B', '#CBD5E0'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { 
                        boxWidth: 10, 
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            family: "'Manrope', sans-serif",
                            size: 11
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#1A202C',
                    bodyColor: '#4A5568',
                    borderColor: '#E2E8F0',
                    borderWidth: 1,
                    padding: 10
                }
            },
            layout: {
                padding: 10
            }
        }
    });
}
