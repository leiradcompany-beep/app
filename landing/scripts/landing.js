/* --- DATA --- */
const getBaseUrl = () => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://127.0.0.1:8000';
    } else {
        return 'https://itsolutions.muccsbblock1.com/cleaning_services/public';
    }
};

const BACKEND_URL = getBaseUrl();
const API_BASE_URL = `${BACKEND_URL}/api`;
let servicesData = [];
let cleanersData = []; // Added to store cleaner data

// State for filtering and pagination
let currentFilter = 'all';
let currentSearch = '';
let displayedCount = 0;
const ITEMS_PER_PAGE = 6;
let filteredData = [];

// Helper function to get proper service image URL
function getServiceImageUrl(imagePath) {
    // Use ImageUtils if available, otherwise fallback to manual logic
    if (typeof ImageUtils !== 'undefined') {
        return ImageUtils.getServiceImageUrl(imagePath);
    }

    // Fallback logic if ImageUtils is not loaded
    if (!imagePath) {
        return '../asset/default-service.png';
    }

    // If it's already a full URL, return as is
    if (imagePath.startsWith('http')) {
        return imagePath;
    }

    // If it's a storage path, construct the full URL
    if (imagePath.startsWith('/storage/')) {
        return `${BACKEND_URL}${imagePath}`;
    }

    // For relative paths, prepend the correct prefix
    if (imagePath.startsWith('assets/') || imagePath.startsWith('storage/')) {
        return `../${imagePath}`;
    }

    // Default fallback
    return '../asset/default-service.png';
}

// Enhanced image loading with better error handling
function loadImageWithFallback(imgElement, primarySrc, fallbackSrc) {
    // Set initial source
    imgElement.src = primarySrc;

    // Add error handler
    imgElement.onerror = function () {
        // If the primary source failed, try the fallback
        if (imgElement.src !== fallbackSrc) {
            imgElement.src = fallbackSrc;
            // Add additional styling for fallback images
            imgElement.style.objectFit = 'contain';
            imgElement.style.backgroundColor = '#f8fafc';
        } else {
            // If fallback also fails, show a placeholder
            console.warn('Both primary and fallback image sources failed:', primarySrc);
        }
    };

    // Add load handler for successful loads
    imgElement.onload = function () {
        // Reset any error styling if image loads successfully
        imgElement.style.objectFit = '';
        imgElement.style.backgroundColor = '';
    };
}

async function fetchServices() {
    try {
        // Fetch only active services (is_active = 1)
        const response = await fetch(`${API_BASE_URL}/services?active_only=true`);
        const result = await response.json();
        if (result.success) {
            // Double-check filtering on client side in case API returns all
            const activeServices = result.data.filter(service => service.is_active === 1 || service.is_active === true || service.is_active === '1');

            servicesData = activeServices.map(service => ({
                id: service.id,
                title: service.title,
                category: service.category,
                price: `₱${service.price}`,
                img: getServiceImageUrl(service.image),
                desc: service.description || "No description available."
            }));

            populateModalSelect(servicesData);
            applyFilters();
        }
    } catch (error) {
        console.error('Error fetching services:', error);
    }
}

const DEFAULT_CLEANER_IMG = "../asset/default-avatar.png";

// Fetch Cleaners (New Function)
async function fetchCleaners() {
    try {
        const response = await fetch(`${API_BASE_URL}/public/cleaners`);
        const result = await response.json();

        if (result.success) {
            cleanersData = result.data.map(cleaner => ({
                name: cleaner.name,
                role: cleaner.job_title || 'Cleaning Specialist',
                img: cleaner.img
                    ? (cleaner.img.startsWith('http') ? cleaner.img : `${BACKEND_URL}${cleaner.img}`)
                    : DEFAULT_CLEANER_IMG,
                desc: `Experience: ${cleaner.experience_years} years. Skills: ${Array.isArray(cleaner.skills) ? cleaner.skills.join(', ') : (cleaner.skills ? JSON.parse(cleaner.skills).join(', ') : 'General Cleaning')}`
            }));
            renderCleaners();
        }
    } catch (error) {
        console.warn('Could not fetch cleaners from API, using fallback data', error);
        // Fallback data matching Seeder
        cleanersData = [
            {
                name: 'Maria Sanchez',
                role: 'Team Lead',
                img: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=600&q=80',
                desc: '10+ years of experience in luxury home detailing and team management.'
            },
            {
                name: 'James Hallow',
                role: 'Deep Clean Expert',
                img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
                desc: 'Specializes in move-in/move-out logistics and heavy-duty sanitization.'
            },
            {
                name: 'Sarah Kim',
                role: 'Eco Pro',
                img: 'https://images.unsplash.com/photo-1590650516494-0c8e4a4dd67e?auto=format&fit=crop&w=600&q=80',
                desc: 'Passionate about green cleaning solutions and allergen-free environments.'
            }
        ];
        renderCleaners();
    }
}

function renderCleaners() {
    const teamGrid = document.getElementById('teamGrid');
    if (!teamGrid) return;

    teamGrid.innerHTML = '';

    cleanersData.forEach(cleaner => {
        const card = document.createElement('div');
        card.className = 'team-card';
        card.innerHTML = `
            <img src="${cleaner.img}" alt="${cleaner.name}">
            <div class="team-info">
                <h3 style="font-size:1.4rem; margin-bottom:5px;">${cleaner.name}</h3>
                <p style="color:var(--accent); font-weight:600; font-size:0.9rem; text-transform:uppercase;">${cleaner.role}</p>
                <p style="margin-top:10px; font-size:0.9rem; opacity:0.9;">${cleaner.desc}</p>
            </div>
        `;
        teamGrid.appendChild(card);
    });
}


/* --- FUNCTIONS --- */
const servicesGrid = document.getElementById('servicesGrid');
const modalSelect = document.getElementById('modalServiceSelect');
const loadMoreBtn = document.getElementById('loadMoreBtn');

function populateModalSelect(data) {
    if (!modalSelect) return;
    modalSelect.innerHTML = '';
    data.forEach(service => {
        const option = document.createElement('option');
        option.value = service.title;
        option.text = service.title;
        modalSelect.appendChild(option);
    });
}

function applyFilters() {
    let data = [];

    // 1. Filter by Category
    if (currentFilter === 'all') {
        data = servicesData;
    } else if (currentFilter === 'Move-In/Out') {
        // Special handling: Check both title and category for "Move-In/Out"
        data = servicesData.filter(s =>
            s.title.includes('Move-In/Out') ||
            s.title.includes('Move-Out') ||
            s.category === 'Move-In/Out'
        );
    } else {
        // Robust filtering:
        // Allow matching against the exact filter name (e.g., "Standard Clean")
        // OR the short backend name (e.g., "Standard")

        const categoryKeywords = {
            'Standard Clean': ['Standard', 'Standard Clean'],
            'Deep Clean': ['Deep', 'Deep Clean'],
            'Specialty': ['Specialty']
        };

        // Get valid variations for the current filter, or default to just the filter name
        const validCategories = categoryKeywords[currentFilter] || [currentFilter];

        data = servicesData.filter(s => validCategories.includes(s.category.trim()));
    }

    // 2. Filter by Search Query
    if (currentSearch) {
        const lowerQ = currentSearch.toLowerCase();
        data = data.filter(s =>
            s.title.toLowerCase().includes(lowerQ) ||
            s.desc.toLowerCase().includes(lowerQ) ||
            s.category.toLowerCase().includes(lowerQ)
        );
    }

    filteredData = data;
    displayedCount = 0;
    servicesGrid.innerHTML = ''; // Clear grid

    // Render first batch
    loadMore();
}

function loadMore() {
    const nextBatch = filteredData.slice(displayedCount, displayedCount + ITEMS_PER_PAGE);

    nextBatch.forEach(service => {
        const card = document.createElement('div');
        card.className = 'service-card';
        card.innerHTML = `
            <div class="service-img-wrapper">
                <img src="${service.img}" alt="${service.title}" onerror="this.src='../asset/default-service.png'; this.style.objectFit='contain'; this.style.backgroundColor='#f8fafc';">
                <span class="category-tag">${service.category}</span>
            </div>
            <div class="service-content">
                <h3 class="service-title">${service.title}</h3>
                <p class="service-text">${service.desc}</p>
                
                <div class="service-footer">
                    <span class="price-tag">${service.price}</span>
                    <button class="book-service-btn" onclick="bookService(${service.id})" style="text-decoration: none; display: inline-block; text-align: center; cursor: pointer; background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 5px;">
                        Book Now <i class="ri-arrow-right-line"></i>
                    </button>
                </div>
            </div>
        `;
        servicesGrid.appendChild(card);
    });

    displayedCount += nextBatch.length;

    // Toggle Load More Button
    if (displayedCount < filteredData.length) {
        loadMoreBtn.classList.remove('hidden');
    } else {
        loadMoreBtn.classList.add('hidden');
    }

    // Show message if no results
    if (filteredData.length === 0) {
        servicesGrid.innerHTML = `
            <div class="empty-state">
                <i class="ri-search-eye-line"></i>
                <h3 style="font-size: 1.2rem; color: var(--text-dark); margin-bottom: 5px;">No services found</h3>
                <p style="color: var(--text-light);">Try adjusting your search or filter to find what you're looking for.</p>
            </div>
        `;
    }
}

function bookService(serviceId) {
    localStorage.setItem('pendingServiceId', serviceId);
    window.location.href = '../../auth/templates/login.html';
}

function filterServices(category, btn) {
    // Update active button state
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    currentFilter = category;
    applyFilters();
}

function searchServices(query) {
    currentSearch = query.trim();
    applyFilters();
}

/* --- CAROUSEL LOGIC --- */
let slideIndex = 0;
const slides = document.querySelectorAll('.hero-slide');

function rotateSlides() {
    slides.forEach(s => s.classList.remove('active'));
    slideIndex = (slideIndex + 1) % slides.length;
    slides[slideIndex].classList.add('active');
}
if (slides.length > 0) {
    setInterval(rotateSlides, 5000);
}

/* --- MODAL LOGIC --- */
const modal = document.getElementById('modalOverlay');

function openModal(serviceName = null) {
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scroll

    if (serviceName && modalSelect) {
        // Select the service in the dropdown
        for (let i = 0; i < modalSelect.options.length; i++) {
            if (modalSelect.options[i].text === serviceName) {
                modalSelect.selectedIndex = i;
                break;
            }
        }
    }
}

function closeModal() {
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

// Close on clicking outside
if (modal) {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

/* --- MOBILE MENU --- */
function toggleMenu() {
    const mobileNav = document.getElementById('mobileNav');
    const mobileToggle = document.querySelector('.mobile-toggle');
    const body = document.body;

    // Toggle menu
    mobileNav.classList.toggle('active');

    // Update ARIA attribute for accessibility
    const isExpanded = mobileNav.classList.contains('active');
    if (mobileToggle) {
        mobileToggle.setAttribute('aria-expanded', isExpanded);
    }

    // Prevent body scroll when menu is open
    if (isExpanded) {
        body.classList.add('menu-open');
    } else {
        body.classList.remove('menu-open');
    }
}

// Close mobile menu when clicking on a link
document.addEventListener('DOMContentLoaded', () => {
    const mobileNavLinks = document.querySelectorAll('#mobileNav a');
    mobileNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // Allow the navigation to happen, then close the menu
            setTimeout(() => {
                toggleMenu();
            }, 100);
        });
    });
});

/* --- INITIALIZATION --- */
document.addEventListener('DOMContentLoaded', () => {
    fetchServices();
    fetchCleaners();
});
