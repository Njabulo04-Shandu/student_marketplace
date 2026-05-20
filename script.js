// Global variables
let currentUser = null;

// ---------- AUTHENTICATION ----------
async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        currentUser = user;
        const authLink = document.getElementById('authLink');
        if (authLink) authLink.innerText = 'Logout';
        if (document.getElementById('userInfo')) {
            document.getElementById('userInfo').innerHTML = `<p>Logged in as: ${user.email}</p>`;
        }
        // Load data for current page
        if (window.location.pathname.includes('dashboard.html')) loadMyProducts();
        if (window.location.pathname.includes('inbox.html')) loadConversations();
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
        const authLink = document.getElementById('authLink');
        if (authLink) authLink.innerText = 'Login';
        if (window.location.pathname.includes('dashboard.html') || window.location.pathname.includes('inbox.html')) {
            window.location.href = 'login.html';
        }
    }
}

async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

async function signup(name, email, password) {
    const { data, error } = await supabase.auth.signUp({ 
        email, 
        password, 
        options: { data: { full_name: name } } 
    });
    if (error) throw error;
    return data;
}

async function logout() {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}

// ---------- PRODUCTS ----------
async function loadProducts() {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('sold', false)
        .order('created_at', { ascending: false });
    if (error) console.error(error);
    else displayProducts(data);
}

async function loadMyProducts() {
    if (!currentUser) return;
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', currentUser.id)
        .order('created_at', { ascending: false });
    if (error) console.error(error);
    else displayMyProducts(data);
}

async function addProduct(title, price, description, imageFile) {
    let imageUrl = '';
    if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { data, error } = await supabase.storage
            .from('product-images')
            .upload(`public/${fileName}`, imageFile);
        if (error) throw error;
        imageUrl = supabase.storage.from('product-images').getPublicUrl(`public/${fileName}`).data.publicUrl;
    }
    const { error } = await supabase.from('products').insert({
        title, price, description, image_url: imageUrl,
        seller_id: currentUser.id, seller_name: currentUser.email.split('@')[0]
    });
    if (error) throw error;
}

async function deleteProduct(productId) {
    const { error } = await supabase.from('products').delete().eq('id', productId).eq('seller_id', currentUser.id);
    if (error) throw error;
}

async function markAsSold(productId) {
    const { error } = await supabase.from('products').update({ sold: true }).eq('id', productId).eq('seller_id', currentUser.id);
    if (error) throw error;
}

// ---------- MESSAGING ----------
async function sendMessage(productId, receiverId, message) {
    const { error } = await supabase.from('messages').insert({
        product_id: productId,
        sender_id: currentUser.id,
        receiver_id: receiverId,
        message: message
    });
    if (error) throw error;
}

async function getConversations() {
    const { data, error } = await supabase
        .from('messages')
        .select('*, product:products(title, id)')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });
    if (error) throw error;
    // Group by product and other user
    const convMap = new Map();
    data.forEach(msg => {
        const otherId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
        const key = `${msg.product_id}-${otherId}`;
        if (!convMap.has(key)) {
            convMap.set(key, {
                productId: msg.product_id,
                productTitle: msg.product.title,
                otherUserId: otherId,
                lastMessage: msg.message,
                lastTime: msg.created_at
            });
        }
    });
    return Array.from(convMap.values());
}

async function getMessages(productId, otherUserId) {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUser.id})`)
        .eq('product_id', productId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
}

// ---------- ADMIN ----------
async function getAllProducts() {
    const { data, error } = await supabase.from('products').select('*, users(email)');
    if (error) throw error;
    return data;
}
async function getAllUsers() {
    // Using admin API requires service role key; we'll use a simpler approach: fetch from auth.users via RPC or just show count.
    // For demo, we'll just fetch products to infer sellers. Alternatively, use supabase.auth.admin.listUsers() but that needs service role.
    // Let's implement a safe version: just list unique seller emails from products.
    const { data } = await supabase.from('products').select('seller_id, users(email)');
    const uniqueUsers = new Map();
    data.forEach(p => {
        if (p.users?.email && !uniqueUsers.has(p.seller_id)) {
            uniqueUsers.set(p.seller_id, p.users.email);
        }
    });
    return Array.from(uniqueUsers.values()).map(email => ({ email }));
}
async function adminDeleteProduct(productId) {
    await supabase.from('products').delete().eq('id', productId);
}

// ---------- DISPLAY FUNCTIONS (with R symbol, no "Rands" text) ----------
function displayProducts(products) {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    if (!products || products.length === 0) {
        grid.innerHTML = '<div class="empty-message">No products available. Be the first to sell something!</div>';
        return;
    }
    grid.innerHTML = '';
    products.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.onclick = () => window.location.href = `product.html?id=${p.id}`;
        card.innerHTML = `
            <img src="${p.image_url || 'https://placehold.co/400x300?text=Item'}" alt="${escapeHtml(p.title)}">
            <h3>${escapeHtml(p.title)}</h3>
            <div class="price">R${p.price.toFixed(2)}</div>
        `;
        grid.appendChild(card);
    });
}

function displayMyProducts(products) {
    const container = document.getElementById('myProductsList');
    if (!container) return;
    if (!products || products.length === 0) {
        container.innerHTML = '<p>You have not listed any products yet.</p>';
        return;
    }
    container.innerHTML = '';
    products.forEach(p => {
        const div = document.createElement('div');
        div.className = 'admin-product-item';
        div.innerHTML = `
            <div><strong>${escapeHtml(p.title)}</strong> - R${p.price}<br>${p.sold ? '[SOLD]' : ''}</div>
            <div>
                <button onclick="markAsSold(${p.id})">Mark Sold</button>
                <button onclick="deleteProduct(${p.id})">Delete</button>
            </div>
        `;
        container.appendChild(div);
    });
}

// Inbox functions
async function loadConversations() {
    const convs = await getConversations();
    const container = document.getElementById('conversationsList');
    if (!container) return;
    if (convs.length === 0) {
        container.innerHTML = '<p>No conversations yet.</p>';
        return;
    }
    container.innerHTML = '';
    convs.forEach(c => {
        const div = document.createElement('div');
        div.className = 'admin-product-item';
        div.innerHTML = `<div><strong>${escapeHtml(c.productTitle)}</strong><br>Last message: ${escapeHtml(c.lastMessage.substring(0,50))}</div>
                         <button onclick="openChat(${c.productId}, '${c.otherUserId}', '${escapeHtml(c.productTitle)}')">Reply</button>`;
        container.appendChild(div);
    });
}

async function openChat(productId, otherUserId, productTitle) {
    const messages = await getMessages(productId, otherUserId);
    const modal = document.getElementById('chatModal');
    const msgContainer = document.getElementById('chatMessages');
    document.getElementById('chatProductTitle').innerText = productTitle;
    msgContainer.innerHTML = '';
    messages.forEach(m => {
        const div = document.createElement('div');
        div.className = `message ${m.sender_id === currentUser.id ? 'sent' : 'received'}`;
        div.innerText = m.message;
        msgContainer.appendChild(div);
    });
    modal.style.display = 'flex';
    window.currentChat = { productId, otherUserId };
}

function closeChat() { 
    document.getElementById('chatModal').style.display = 'none'; 
}

async function sendMessage() {
    const input = document.getElementById('chatMessageInput');
    const msg = input.value.trim();
    if (!msg || !window.currentChat) return;
    await sendMessage(window.currentChat.productId, window.currentChat.otherUserId, msg);
    input.value = '';
    openChat(window.currentChat.productId, window.currentChat.otherUserId, document.getElementById('chatProductTitle').innerText);
}

// Admin display
async function loadAdminStats() {
    const products = await getAllProducts();
    const users = await getAllUsers();
    document.getElementById('stats').innerHTML = `
        <div class="stat-card">Total Products: ${products.length}</div>
        <div class="stat-card">Total Users: ${users.length}</div>
    `;
}
async function loadAllProductsForAdmin() {
    const products = await getAllProducts();
    const container = document.getElementById('allProductsList');
    if (!container) return;
    container.innerHTML = '';
    products.forEach(p => {
        const div = document.createElement('div');
        div.className = 'admin-product-item';
        div.innerHTML = `${escapeHtml(p.title)} - R${p.price} <button onclick="adminDeleteProduct(${p.id})">Delete</button>`;
        container.appendChild(div);
    });
}
async function loadAllUsers() {
    const users = await getAllUsers();
    const container = document.getElementById('allUsersList');
    if (!container) return;
    container.innerHTML = '';
    users.forEach(u => {
        container.innerHTML += `<div>${escapeHtml(u.email)}</div>`;
    });
}

// ---------- UTILITIES ----------
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ---------- EVENT LISTENERS ----------
if (document.getElementById('addProductForm')) {
    document.getElementById('addProductForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('productTitle').value;
        const price = parseFloat(document.getElementById('productPrice').value);
        const description = document.getElementById('productDesc').value;
        const imageFile = document.getElementById('productImage').files[0];
        try {
            await addProduct(title, price, description, imageFile);
            await loadMyProducts();
            e.target.reset();
            alert('Product added!');
        } catch(err) {
            alert('Error: ' + err.message);
        }
    });
}

if (document.getElementById('loginForm')) {
    document.getElementById('loginTab').onclick = () => {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('signupForm').style.display = 'none';
        document.getElementById('loginTab').classList.add('active');
        document.getElementById('signupTab').classList.remove('active');
    };
    document.getElementById('signupTab').onclick = () => {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('signupForm').style.display = 'block';
        document.getElementById('signupTab').classList.add('active');
        document.getElementById('loginTab').classList.remove('active');
    };
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const pwd = document.getElementById('loginPassword').value;
        try {
            await login(email, pwd);
            window.location.href = 'index.html';
        } catch(err) { alert('Login failed: '+err.message); }
    });
    document.getElementById('signupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const pwd = document.getElementById('signupPassword').value;
        try {
            await signup(name, email, pwd);
            alert('Account created! You can now login.');
            document.getElementById('loginTab').click();
        } catch(err) { alert('Signup failed: '+err.message); }
    });
}

if (document.getElementById('authLink')) {
    document.getElementById('authLink').addEventListener('click', async (e) => {
        e.preventDefault();
        if (currentUser) await logout();
        else window.location.href = 'login.html';
    });
}

if (document.getElementById('searchInput')) {
    document.getElementById('searchInput').addEventListener('input', async () => {
        const term = document.getElementById('searchInput').value.toLowerCase();
        const { data } = await supabase.from('products').select('*').eq('sold', false).ilike('title', `%${term}%`);
        displayProducts(data);
    });
}

// Product detail page logic
if (window.location.pathname.includes('product.html')) {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    window.onload = async () => {
        await checkAuth();
        const { data: product, error } = await supabase.from('products').select('*').eq('id', productId).single();
        if (error || !product) {
            document.getElementById('productDetail').innerHTML = '<p>Product not found.</p>';
            return;
        }
        document.getElementById('productDetail').innerHTML = `
            <h1>${escapeHtml(product.title)}</h1>
            <img src="${product.image_url || 'https://placehold.co/400x300?text=Item'}" style="max-width:300px; border-radius:16px;">
            <p><strong>Price:</strong> R${product.price}</p>
            <p><strong>Description:</strong> ${escapeHtml(product.description)}</p>
            <p><strong>Seller:</strong> ${escapeHtml(product.seller_name)}</p>
        `;
        if (currentUser && currentUser.id !== product.seller_id) {
            document.getElementById('messageBox').style.display = 'block';
            document.getElementById('sendMsgBtn').onclick = async () => {
                const msg = document.getElementById('messageText').value;
                if (msg.trim()) {
                    await sendMessage(product.id, product.seller_id, msg);
                    alert('Message sent!');
                    document.getElementById('messageText').value = '';
                } else {
                    alert('Please enter a message.');
                }
            };
        }
    };
}

// Initialize auth and load products on pages that need them
if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('product.html')) {
    checkAuth();
}
if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname === '') {
    window.onload = () => {
        checkAuth();
        loadProducts();
    };
}