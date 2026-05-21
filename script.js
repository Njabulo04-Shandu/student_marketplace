// Global variables
let currentUser = null;
let currentChat = null;
let activeCategory = 'All';   // for homepage category filtering

function getSupabase() {
    if (!window.supabaseClient) {
        console.error("Supabase client not initialized");
        return null;
    }
    return window.supabaseClient;
}

// ========== AUTH & UI ==========
async function checkAuth(redirectIfNotLoggedIn = true) {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        currentUser = user;
        updateUIForLoggedIn();
        // Load page-specific data
        if (window.location.pathname.includes('dashboard.html')) loadMyProducts();
        if (window.location.pathname.includes('inbox.html')) loadConversations();
        if (window.location.pathname.includes('profile.html')) loadProfile();
        if (window.location.pathname.includes('admin.html')) {
            if (user.email === 'admin@cut.ac.za') {
                loadAdminStats();
                loadAllProductsForAdmin();
                loadAllUsers();
            } else {
                window.location.href = 'index.html';
            }
        }
    } else {
        if (redirectIfNotLoggedIn && !window.location.pathname.includes('login.html') && !window.location.pathname.includes('index.html')) {
            window.location.href = 'login.html';
        }
        updateUIForLoggedOut();
    }
}

function updateUIForLoggedIn() {
    const name = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
    const initial = name.charAt(0).toUpperCase();
    const desktopAuth = document.getElementById('authLink');
    if (desktopAuth) desktopAuth.innerHTML = initial;
    // Update mobile menu if present
    const mobileAvatar = document.getElementById('mobileAvatar');
    const mobileUserName = document.getElementById('mobileUserName');
    const mobileUserEmail = document.getElementById('mobileUserEmail');
    if (mobileAvatar) mobileAvatar.innerText = initial;
    if (mobileUserName) mobileUserName.innerText = name;
    if (mobileUserEmail) mobileUserEmail.innerText = currentUser.email;
    const mobileAdminLink = document.getElementById('mobileAdminLink');
    if (mobileAdminLink && currentUser.email === 'admin@cut.ac.za') {
        mobileAdminLink.classList.remove('hidden');
        mobileAdminLink.href = 'admin.html';
    }
}

function updateUIForLoggedOut() {
    const desktopAuth = document.getElementById('authLink');
    if (desktopAuth) desktopAuth.innerHTML = '?';
    const mobileUserName = document.getElementById('mobileUserName');
    if (mobileUserName) mobileUserName.innerText = 'Student';
    const mobileUserEmail = document.getElementById('mobileUserEmail');
    if (mobileUserEmail) mobileUserEmail.innerText = '';
}

async function logout() {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}

// ========== PRODUCTS (with category & search) ==========
async function loadProducts() {
    const supabase = getSupabase();
    let query = supabase.from('products').select('*').eq('sold', false);
    if (activeCategory !== 'All') query = query.eq('category', activeCategory);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) console.error(error);
    else applySearchFilter(data);
}

function applySearchFilter(products) {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    if (!searchTerm) {
        displayProducts(products);
    } else {
        const filtered = products.filter(p => p.title.toLowerCase().includes(searchTerm));
        displayProducts(filtered);
    }
}

function displayProducts(products) {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    if (!products || products.length === 0) {
        grid.innerHTML = '<div class="text-center py-20 text-gray-500">No products available. Be the first to sell something!</div>';
        return;
    }
    grid.innerHTML = '';
    products.forEach(p => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl overflow-hidden shadow-sm border hover:shadow-md transition-all cursor-pointer product-card';
        card.onclick = () => window.location.href = `product.html?id=${p.id}`;
        card.innerHTML = `
            <div class="aspect-[4/3] bg-gray-100 relative">
                <img src="${p.image_url || 'https://placehold.co/400x300?text=No+Image'}" class="w-full h-full object-cover">
                <span class="absolute top-2 left-2 bg-white/90 text-xs px-2.5 py-1 rounded-full">${p.category || 'Other'}</span>
                ${p.sold ? '<div class="absolute inset-0 bg-black/50 flex items-center justify-center"><span class="bg-[#c8102e] text-white px-4 py-1 rounded-full text-sm font-bold">SOLD</span></div>' : ''}
            </div>
            <div class="p-4">
                <h3 class="font-semibold text-gray-800 truncate">${escapeHtml(p.title)}</h3>
                <p class="text-[#c8102e] font-bold text-lg mt-1">R${p.price}</p>
                <p class="text-xs text-gray-500">by ${escapeHtml(p.seller_name)}</p>
            </div>
        `;
        grid.appendChild(card);
    });
}

async function loadMyProducts() {
    if (!currentUser) return;
    const supabase = getSupabase();
    const { data, error } = await supabase.from('products').select('*').eq('seller_id', currentUser.id).order('created_at', { ascending: false });
    if (error) console.error(error);
    else displayMyProducts(data);
}

function displayMyProducts(products) {
    const container = document.getElementById('myProductsList');
    if (!container) return;
    if (!products || products.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-gray-500">No listings yet.</div>';
        return;
    }
    container.innerHTML = '';
    products.forEach(p => {
        const div = document.createElement('div');
        div.className = 'bg-white rounded-xl border p-4 flex items-center gap-4';
        div.innerHTML = `
            <div class="h-16 w-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                ${p.image_url ? `<img src="${p.image_url}" class="w-full h-full object-cover">` : '<div class="w-full h-full flex items-center justify-center text-gray-400">📦</div>'}
            </div>
            <div class="flex-1">
                <h3 class="font-semibold">${escapeHtml(p.title)}</h3>
                <p class="text-[#c8102e] font-bold">R${p.price}</p>
                ${p.sold ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Sold</span>' : ''}
            </div>
            <div class="flex gap-2">
                ${!p.sold ? `<button onclick="markAsSold(${p.id})" class="text-green-600 hover:bg-green-50 p-2 rounded-lg" title="Mark sold">✅</button>` : ''}
                <button onclick="deleteProduct(${p.id})" class="text-red-600 hover:bg-red-50 p-2 rounded-lg" title="Delete">🗑️</button>
            </div>
        `;
        container.appendChild(div);
    });
}

async function addProduct(title, price, description, category, imageFile) {
    const supabase = getSupabase();
    let imageUrl = '';
    if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { error } = await supabase.storage.from('product-images').upload(`public/${fileName}`, imageFile);
        if (error) throw error;
        imageUrl = supabase.storage.from('product-images').getPublicUrl(`public/${fileName}`).data.publicUrl;
    }
    const { error } = await supabase.from('products').insert({
        title, price, description, category,
        image_url: imageUrl,
        seller_id: currentUser.id,
        seller_name: currentUser.user_metadata?.full_name || currentUser.email.split('@')[0],
        seller_email: currentUser.email,
        sold: false
    });
    if (error) throw error;
}

async function deleteProduct(productId) {
    const supabase = getSupabase();
    await supabase.from('products').delete().eq('id', productId).eq('seller_id', currentUser.id);
    loadMyProducts();
    alert('Product deleted');
}

async function markAsSold(productId) {
    const supabase = getSupabase();
    await supabase.from('products').update({ sold: true }).eq('id', productId).eq('seller_id', currentUser.id);
    loadMyProducts();
    alert('Marked as sold');
}

// ========== MESSAGING ==========
async function sendMessage(productId, receiverId, message, productTitle, receiverEmail, senderName) {
    const supabase = getSupabase();
    await supabase.from('messages').insert({
        product_id: productId,
        product_title: productTitle,
        sender_email: currentUser.email,
        sender_name: senderName || currentUser.user_metadata?.full_name || currentUser.email,
        receiver_email: receiverEmail,
        content: message,
        read: false
    });
}

async function getConversations() {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('messages').select('*').or(`sender_email.eq.${currentUser.email},receiver_email.eq.${currentUser.email}`).order('created_at', { ascending: false });
    if (error) throw error;
    const convMap = new Map();
    data.forEach(msg => {
        const otherEmail = msg.sender_email === currentUser.email ? msg.receiver_email : msg.sender_email;
        const key = `${msg.product_id}_${otherEmail}`;
        if (!convMap.has(key)) {
            convMap.set(key, {
                productId: msg.product_id,
                productTitle: msg.product_title,
                otherEmail: otherEmail,
                otherName: msg.sender_email === currentUser.email ? 'Buyer' : msg.sender_name,
                lastMessage: msg.content,
                lastDate: msg.created_at,
                unread: (msg.receiver_email === currentUser.email && !msg.read) ? 1 : 0
            });
        } else if (msg.receiver_email === currentUser.email && !msg.read) {
            convMap.get(key).unread++;
        }
    });
    return Array.from(convMap.values());
}

async function loadConversations() {
    const convs = await getConversations();
    const container = document.getElementById('conversationsList');
    if (!container) return;
    if (convs.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-gray-500">No conversations yet.</div>';
        return;
    }
    container.innerHTML = '';
    convs.forEach(c => {
        const div = document.createElement('div');
        div.className = 'bg-white rounded-xl border p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50';
        div.onclick = () => openChat(c.productId, c.productTitle, c.otherEmail, c.otherName);
        div.innerHTML = `
            <div class="h-10 w-10 rounded-full bg-[#003261] flex items-center justify-center text-white font-bold">${c.otherName[0]?.toUpperCase()}</div>
            <div class="flex-1">
                <div class="flex justify-between"><span class="font-semibold">${escapeHtml(c.otherName)}</span>${c.unread ? `<span class="bg-[#c8102e] text-white text-xs rounded-full px-2">${c.unread}</span>` : ''}</div>
                <p class="text-xs text-gray-500">Re: ${escapeHtml(c.productTitle)}</p>
                <p class="text-xs text-gray-500 truncate">${escapeHtml(c.lastMessage.substring(0, 50))}</p>
            </div>
        `;
        container.appendChild(div);
    });
}

async function openChat(productId, productTitle, otherEmail, otherName) {
    const supabase = getSupabase();
    const { data: messages } = await supabase.from('messages').select('*').eq('product_id', productId)
        .or(`and(sender_email.eq.${currentUser.email},receiver_email.eq.${otherEmail}),and(sender_email.eq.${otherEmail},receiver_email.eq.${currentUser.email})`)
        .order('created_at', { ascending: true });
    const modal = document.getElementById('chatModal');
    if (!modal) return;
    document.getElementById('chatOtherName').innerText = otherName;
    document.getElementById('chatProductTitle').innerText = productTitle;
    const container = document.getElementById('chatMessages');
    container.innerHTML = '';
    messages.forEach(m => {
        const div = document.createElement('div');
        div.className = `flex ${m.sender_email === currentUser.email ? 'justify-end' : 'justify-start'} mb-2`;
        div.innerHTML = `<div class="max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${m.sender_email === currentUser.email ? 'bg-[#003261] text-white' : 'bg-gray-100 text-gray-800'}">${escapeHtml(m.content)}</div>`;
        container.appendChild(div);
    });
    modal.classList.remove('hidden');
    window.currentChat = { productId, productTitle, otherEmail, otherName };
    container.scrollTop = container.scrollHeight;
}

function closeChat() {
    const modal = document.getElementById('chatModal');
    if (modal) modal.classList.add('hidden');
    window.currentChat = null;
}

async function sendChatMessage() {
    const input = document.getElementById('chatMessageInput');
    const msg = input.value.trim();
    if (!msg || !window.currentChat) return;
    await sendMessage(window.currentChat.productId, null, msg, window.currentChat.productTitle, window.currentChat.otherEmail, window.currentChat.otherName);
    input.value = '';
    openChat(window.currentChat.productId, window.currentChat.productTitle, window.currentChat.otherEmail, window.currentChat.otherName);
}

// ========== PROFILE ==========
async function loadProfile() {
    if (!currentUser) return;
    const supabase = getSupabase();
    const name = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
    const email = currentUser.email;
    const { count: productCount } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('seller_id', currentUser.id);
    const { count: soldCount } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('seller_id', currentUser.id).eq('sold', true);
    const container = document.getElementById('profileContent');
    if (!container) return;
    container.innerHTML = `
        <div class="bg-white rounded-2xl border p-6 mb-6">
            <div class="flex items-center gap-4">
                <div class="h-16 w-16 rounded-full bg-[#003261] flex items-center justify-center text-white text-2xl font-bold">${name[0].toUpperCase()}</div>
                <div><h2 class="text-xl font-bold">${escapeHtml(name)}</h2><p class="text-gray-500 text-sm">${escapeHtml(email)}</p></div>
            </div>
            <div class="grid grid-cols-2 gap-4 mt-6">
                <div class="bg-gray-100 rounded-xl p-4 text-center"><p class="text-2xl font-bold">${productCount}</p><p class="text-xs">Listings</p></div>
                <div class="bg-gray-100 rounded-xl p-4 text-center"><p class="text-2xl font-bold">${soldCount}</p><p class="text-xs">Sold</p></div>
            </div>
            <div class="mt-4"><button id="editProfileBtn" class="bg-[#c8102e] text-white px-4 py-2 rounded-xl text-sm">Edit Profile</button></div>
            <div id="editProfileForm" class="hidden mt-4"><input type="text" id="editName" value="${escapeHtml(name)}" class="w-full bg-gray-100 rounded-xl px-4 py-2 text-sm"><button id="saveProfileBtn" class="mt-2 bg-[#003261] text-white px-4 py-2 rounded-xl text-sm">Save</button></div>
            <div class="mt-6"><button id="logoutBtn" class="w-full bg-red-600 text-white py-2 rounded-xl">Sign Out</button></div>
        </div>
        <div class="bg-white rounded-2xl border p-6"><h3 class="font-semibold mb-3">My Recent Listings</h3><div id="recentListings"></div></div>
    `;
    const { data: recent } = await supabase.from('products').select('*').eq('seller_id', currentUser.id).limit(5);
    const recentDiv = document.getElementById('recentListings');
    if (recent && recent.length) {
        recentDiv.innerHTML = recent.map(p => `<div class="border-b py-2">${escapeHtml(p.title)} - R${p.price}</div>`).join('');
        recentDiv.innerHTML += `<a href="dashboard.html" class="text-sm text-[#c8102e] mt-2 inline-block">See all →</a>`;
    } else recentDiv.innerHTML = '<p class="text-gray-500">No listings yet.</p>';
    document.getElementById('editProfileBtn').onclick = () => { document.getElementById('editProfileForm').classList.toggle('hidden'); };
    document.getElementById('saveProfileBtn').onclick = async () => {
        const newName = document.getElementById('editName').value;
        const { error } = await supabase.auth.updateUser({ data: { full_name: newName } });
        if (error) alert(error.message);
        else location.reload();
    };
    document.getElementById('logoutBtn').onclick = () => logout();
}

// ========== ADMIN ==========
async function getAllProducts() {
    const supabase = getSupabase();
    const { data } = await supabase.from('products').select('*');
    return data || [];
}
async function getAllUsers() {
    const supabase = getSupabase();
    const { data } = await supabase.from('products').select('seller_email').not('seller_email', 'is', null);
    const emails = new Set();
    data?.forEach(p => emails.add(p.seller_email));
    emails.add('admin@cut.ac.za');
    return Array.from(emails).map(email => ({ email }));
}
async function adminDeleteProduct(id) {
    const supabase = getSupabase();
    await supabase.from('products').delete().eq('id', id);
}
async function loadAdminStats() {
    const products = await getAllProducts();
    const users = await getAllUsers();
    document.getElementById('stats').innerHTML = `
        <div class="bg-white rounded-xl border p-6 text-center"><p class="text-3xl font-bold">${products.length}</p><p class="text-gray-500">Products</p></div>
        <div class="bg-white rounded-xl border p-6 text-center"><p class="text-3xl font-bold">${users.length}</p><p class="text-gray-500">Users</p></div>
    `;
}
async function loadAllProductsForAdmin() {
    const products = await getAllProducts();
    const container = document.getElementById('allProductsList');
    if (!container) return;
    container.innerHTML = '';
    products.forEach(p => {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-4 border-b';
        div.innerHTML = `<div><p class="font-medium">${escapeHtml(p.title)}</p><p class="text-sm text-gray-500">R${p.price} · ${escapeHtml(p.seller_name)}</p></div>
                         <button onclick="adminDeleteProduct(${p.id})" class="text-red-600 hover:bg-red-50 p-2 rounded-lg">Delete</button>`;
        container.appendChild(div);
    });
}
async function loadAllUsers() {
    const users = await getAllUsers();
    const container = document.getElementById('allUsersList');
    if (!container) return;
    container.innerHTML = '';
    users.forEach(u => {
        container.innerHTML += `<div class="p-3 border-b">${escapeHtml(u.email)}</div>`;
    });
}

// ========== HELPERS ==========
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
}

// ========== EVENT HANDLERS & UI SETUP ==========
function setupEventListeners() {
    // Add product form
    const addForm = document.getElementById('addProductForm');
    if (addForm) {
        addForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('productTitle').value;
            const price = parseFloat(document.getElementById('productPrice').value);
            const desc = document.getElementById('productDesc').value;
            const category = document.getElementById('productCategory').value;
            const file = document.getElementById('productImage').files[0];
            try {
                await addProduct(title, price, desc, category, file);
                loadMyProducts();
                addForm.reset();
                const fileNameSpan = document.getElementById('fileName');
                if (fileNameSpan) fileNameSpan.innerText = 'Upload image';
                alert('Product listed!');
            } catch (err) { alert('Error: ' + err.message); }
        });
        const fileInput = document.getElementById('productImage');
        if (fileInput) {
            fileInput.onchange = (e) => {
                const label = document.getElementById('fileName');
                if (label) label.innerText = e.target.files[0]?.name || 'Upload image';
            };
        }
    }

    // Search input (homepage)
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', async () => {
            const supabase = getSupabase();
            let query = supabase.from('products').select('*').eq('sold', false);
            if (activeCategory !== 'All') query = query.eq('category', activeCategory);
            const { data, error } = await query.order('created_at', { ascending: false });
            if (!error) {
                const term = searchInput.value.toLowerCase();
                const filtered = term ? data.filter(p => p.title.toLowerCase().includes(term)) : data;
                displayProducts(filtered);
            }
        });
    }

    // Category chips (homepage)
    const categoryChips = document.querySelectorAll('.category-chip');
    if (categoryChips.length) {
        categoryChips.forEach(chip => {
            chip.addEventListener('click', async function(e) {
                e.stopPropagation();
                const category = this.getAttribute('data-category');
                activeCategory = category;
                // Update active styles
                categoryChips.forEach(c => {
                    c.classList.remove('bg-[#003261]', 'text-white');
                    c.classList.add('bg-gray-200', 'text-gray-700');
                });
                this.classList.remove('bg-gray-200', 'text-gray-700');
                this.classList.add('bg-[#003261]', 'text-white');
                // Reload products with selected category
                const supabase = getSupabase();
                let query = supabase.from('products').select('*').eq('sold', false);
                if (activeCategory !== 'All') query = query.eq('category', activeCategory);
                const { data, error } = await query.order('created_at', { ascending: false });
                if (!error) {
                    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
                    const filtered = searchTerm ? data.filter(p => p.title.toLowerCase().includes(searchTerm)) : data;
                    displayProducts(filtered);
                }
            });
        });
    }

    // Mobile menu
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobileMenu');
    const closeMenu = document.getElementById('closeMenu');
    if (hamburger && mobileMenu) {
        hamburger.onclick = () => mobileMenu.classList.remove('hidden');
        if (closeMenu) closeMenu.onclick = () => mobileMenu.classList.add('hidden');
    }
    const mobileLogout = document.getElementById('mobileLogout');
    if (mobileLogout) mobileLogout.onclick = () => logout();

    // Shop now button scroll
    const shopNow = document.getElementById('shopNowBtn');
    if (shopNow) {
        shopNow.onclick = () => document.querySelector('#productGrid')?.scrollIntoView({ behavior: 'smooth' });
    }

    // Product detail message
    const sendProductMsg = document.getElementById('sendMsgBtn');
    if (sendProductMsg && window.location.pathname.includes('product.html')) {
        sendProductMsg.onclick = async () => {
            const msg = document.getElementById('messageText').value;
            if (!msg || !window.productSeller) return;
            await sendMessage(window.productId, null, msg, window.productTitle, window.productSeller.email, window.productSeller.name);
            alert('Message sent!');
            document.getElementById('messageText').value = '';
        };
    }

    // Chat modal close
    const closeChatBtn = document.getElementById('closeChatBtn');
    if (closeChatBtn) closeChatBtn.onclick = closeChat;
    const sendChat = document.getElementById('sendMsgBtn');
    if (sendChat && document.getElementById('chatModal')) {
        sendChat.onclick = sendChatMessage;
    }

    // Google login button
    const googleBtn = document.getElementById('googleLoginBtn');
    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            const supabase = getSupabase();
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin + '/index.html' }
            });
            if (error) alert('Google login failed: ' + error.message);
        });
    }
}

// ========== PRODUCT DETAIL PAGE ==========
async function loadProductDetail() {
    if (!window.location.pathname.includes('product.html')) return;
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    const supabase = getSupabase();
    const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();
    if (!product) { document.getElementById('productDetail').innerHTML = '<p>Product not found.</p>'; return; }
    document.getElementById('productDetail').innerHTML = `
        <div class="bg-white rounded-2xl overflow-hidden shadow-sm border md:flex">
            <div class="md:w-1/2 aspect-square bg-gray-100 relative">
                <img src="${product.image_url || 'https://placehold.co/600x400?text=No+Image'}" class="w-full h-full object-cover">
                ${product.sold ? '<div class="absolute inset-0 bg-black/50 flex items-center justify-center"><span class="bg-[#c8102e] text-white px-6 py-2 rounded-full text-lg font-bold">SOLD</span></div>' : ''}
            </div>
            <div class="md:w-1/2 p-6 md:p-8">
                <span class="text-xs bg-gray-100 px-3 py-1 rounded-full">${product.category || 'Other'}</span>
                <h1 class="text-2xl font-bold mt-3">${escapeHtml(product.title)}</h1>
                <p class="text-3xl font-bold text-[#c8102e] mt-2">R${product.price}</p>
                <p class="text-gray-600 mt-4 whitespace-pre-wrap">${escapeHtml(product.description)}</p>
                <div class="mt-6 pt-6 border-t"><p class="text-sm text-gray-500">Seller</p><p class="font-semibold">${escapeHtml(product.seller_name)}</p></div>
            </div>
        </div>
    `;
    if (currentUser && currentUser.email !== product.seller_email && !product.sold) {
        const msgBox = document.getElementById('messageBox');
        if (msgBox) {
            msgBox.classList.remove('hidden');
            window.productId = product.id;
            window.productTitle = product.title;
            window.productSeller = { email: product.seller_email, name: product.seller_name };
        }
    }
}

// ========== INITIALIZE ==========
document.addEventListener('DOMContentLoaded', () => {
    window.initSupabase();
    setTimeout(() => {
        checkAuth(true);
        setupEventListeners();
        if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname === '') {
            activeCategory = 'All';
            loadProducts();
        }
        if (window.location.pathname.includes('product.html')) loadProductDetail();
    }, 100);
});