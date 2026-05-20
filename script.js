// ---------- DATA ----------
let products = [];
let currentSellerId = 1;
let currentSellerName = "Demo Student";

// ---------- LOCALSTORAGE ----------
function saveProducts() {
    localStorage.setItem("marketplace_products", JSON.stringify(products));
}

function loadProducts() {
    const stored = localStorage.getItem("marketplace_products");
    if (stored && stored !== "undefined") {
        products = JSON.parse(stored);
    } else {
        // seed with example products in ZAR (South African Rand)
        products = [
            {
                id: 101,
                title: "Used Calculus Textbook",
                price: 250,
                description: "Good condition, no highlights. Pick up at library.",
                image: "https://placehold.co/400x300?text=Textbook",
                sellerId: 1,
                sellerName: "Thabo"
            },
            {
                id: 102,
                title: "LED Desk Lamp",
                price: 120,
                description: "White lamp, works perfectly. USB powered.",
                image: "https://placehold.co/400x300?text=Lamp",
                sellerId: 2,
                sellerName: "Lerato"
            },
            {
                id: 103,
                title: "Mini Fridge",
                price: 450,
                description: "Dorm size, clean inside. Local pickup only.",
                image: "https://placehold.co/400x300?text=Fridge",
                sellerId: 1,
                sellerName: "Thabo"
            }
        ];
        saveProducts();
    }
}

// ---------- HELPERS ----------
function getProductById(id) {
    return products.find(p => p.id === id);
}

// ---------- HOMEPAGE (product grid) ----------
function displayProductGrid() {
    const grid = document.getElementById("productGrid");
    if (!grid) return;
    grid.innerHTML = "";
    if (products.length === 0) {
        grid.innerHTML = "<p style='grid-column:1/-1; text-align:center;'>No products yet. Be the first to sell something!</p>";
        return;
    }
    products.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";
        card.onclick = () => {
            window.location.href = `product.html?id=${product.id}`;
        };
        card.innerHTML = `
            <img src="${product.image || 'https://placehold.co/400x300?text=No+Image'}" alt="${escapeHtml(product.title)}">
            <h3>${escapeHtml(product.title)}</h3>
            <div class="price">R${product.price.toFixed(2)}</div>
        `;
        grid.appendChild(card);
    });
}

// ---------- SELLER DASHBOARD ----------
function displayMyProducts() {
    const container = document.getElementById("myProductsList");
    if (!container) return;
    const myProducts = products.filter(p => p.sellerId === currentSellerId);
    if (myProducts.length === 0) {
        container.innerHTML = "<p>You haven't added any products yet.</p>";
        return;
    }
    container.innerHTML = "";
    myProducts.forEach(p => {
        const div = document.createElement("div");
        div.className = "product-card";
        div.style.display = "flex";
        div.style.justifyContent = "space-between";
        div.style.alignItems = "center";
        div.innerHTML = `
            <div>
                <strong>${escapeHtml(p.title)}</strong><br>
                R${p.price.toFixed(2)}
            </div>
            <button onclick="deleteMyProduct(${p.id})">Delete</button>
        `;
        container.appendChild(div);
    });
}

function deleteMyProduct(id) {
    if (confirm("Delete this product?")) {
        products = products.filter(p => p.id !== id);
        saveProducts();
        displayMyProducts();
        displayProductGrid();
        alert("Product deleted.");
    }
}

function setupAddProductForm() {
    const form = document.getElementById("addProductForm");
    if (!form) return;
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const title = document.getElementById("productTitle").value.trim();
        const price = parseFloat(document.getElementById("productPrice").value);
        const description = document.getElementById("productDesc").value.trim();
        let image = document.getElementById("productImage").value.trim();
        if (!title || isNaN(price)) {
            alert("Please enter title and valid price.");
            return;
        }
        if (!image) image = "https://placehold.co/400x300?text=New+Item";
        const newId = Date.now();
        const newProduct = {
            id: newId,
            title: title,
            price: price,
            description: description || "No description provided.",
            image: image,
            sellerId: currentSellerId,
            sellerName: currentSellerName
        };
        products.push(newProduct);
        saveProducts();
        displayMyProducts();
        displayProductGrid();
        form.reset();
        alert("Product added successfully!");
    });
}

// ---------- PRODUCT DETAIL PAGE ----------
function displayProductDetail() {
    const container = document.getElementById("productDetail");
    if (!container) return;
    const urlParams = new URLSearchParams(window.location.search);
    const productId = parseInt(urlParams.get("id"));
    const product = getProductById(productId);
    if (!product) {
        container.innerHTML = "<p>❌ Product not found. <a href='index.html'>Go back home</a></p>";
        return;
    }
    container.innerHTML = `
        <img src="${product.image || 'https://placehold.co/400x300?text=No+Image'}" alt="${escapeHtml(product.title)}">
        <h2>${escapeHtml(product.title)}</h2>
        <p class="price" style="font-size:28px;">R${product.price.toFixed(2)}</p>
        <p><strong>Description:</strong> ${escapeHtml(product.description)}</p>
        <p><strong>Seller:</strong> ${escapeHtml(product.sellerName)}</p>
        <button class="contact-btn" onclick="contactSeller('${product.sellerName}', '${product.title}')">📩 Contact Seller</button>
        <br><br>
        <a href="index.html">← Back to all items</a>
    `;
}

function contactSeller(sellerName, productTitle) {
    const message = `Hi ${sellerName}, I'm interested in buying "${productTitle}" from Student Marketplace. Is it still available?`;
    if (confirm("Send message to seller?\n\n" + message + "\n\nClick OK to copy to clipboard.")) {
        navigator.clipboard.writeText(message);
        alert("Message copied! You can now paste it into WhatsApp, email, or any chat.");
    }
}

// ---------- ADMIN PAGE (base functions, overridden in admin.html) ----------
function displayAdminStats() {
    const statsDiv = document.getElementById("stats");
    if (!statsDiv) return;
    const totalProducts = products.length;
    const uniqueSellers = new Set(products.map(p => p.sellerId)).size;
    statsDiv.innerHTML = `
        <div class="stat-card"><div class="stat-number">${totalProducts}</div><div>Total Listings</div></div>
        <div class="stat-card"><div class="stat-number">${uniqueSellers}</div><div>Active Sellers</div></div>
        <div class="stat-card"><div class="stat-number">R0</div><div>Sales (demo)</div></div>
    `;
}

function displayAllProductsForAdmin() {
    const container = document.getElementById("allProductsList");
    if (!container) return;
    if (products.length === 0) {
        container.innerHTML = "<p>No products in the marketplace.</p>";
        return;
    }
    container.innerHTML = "";
    products.forEach(product => {
        const div = document.createElement("div");
        div.className = "admin-product-item";
        div.innerHTML = `
            <div>
                <strong>${escapeHtml(product.title)}</strong> - R${product.price.toFixed(2)}<br>
                <small>Seller: ${escapeHtml(product.sellerName)} (ID: ${product.sellerId})</small>
            </div>
            <button class="delete-btn" onclick="adminDeleteProduct(${product.id})">🗑️ Delete</button>
        `;
        container.appendChild(div);
    });
}

function adminDeleteProduct(id) {
    if (confirm("⚠️ Permanently delete this product? This action cannot be undone.")) {
        products = products.filter(p => p.id !== id);
        saveProducts();
        displayAllProductsForAdmin();
        displayAdminStats();
        displayProductGrid();
        alert("Product deleted from marketplace.");
    }
}

// ---------- FAKE LOGIN / DEMO SELLER SWITCHER ----------
function setupFakeLogin() {
    const loginLink = document.getElementById("fakeLoginLink");
    if (!loginLink) return;
    loginLink.addEventListener("click", (e) => {
        e.preventDefault();
        const newId = prompt(`Current seller: ${currentSellerName} (ID ${currentSellerId})\nEnter new Seller ID (1,2,3) or name:`, currentSellerId);
        if (newId !== null) {
            const numId = parseInt(newId);
            if (!isNaN(numId) && numId > 0) {
                currentSellerId = numId;
                currentSellerName = `Seller${numId}`;
            } else if (newId.trim() !== "") {
                currentSellerName = newId.trim();
                currentSellerId = currentSellerName.length * 7;
            } else {
                return;
            }
            const sellerDiv = document.getElementById("sellerInfo");
            if (sellerDiv) {
                sellerDiv.innerHTML = `👋 Selling as: <strong>${escapeHtml(currentSellerName)}</strong> (ID: ${currentSellerId})<br>
                <span style="font-size:12px;">Click "Login" again to change identity</span>`;
            }
            displayMyProducts();
            alert(`Now logged in as ${currentSellerName}. Your products will show on your dashboard.`);
        }
    });
    const sellerDiv = document.getElementById("sellerInfo");
    if (sellerDiv) {
        sellerDiv.innerHTML = `👋 Selling as: <strong>${escapeHtml(currentSellerName)}</strong> (ID: ${currentSellerId})<br>
        <span style="font-size:12px;">Click "Login (demo)" to change identity</span>`;
    }
}

// ---------- UTILITY ----------
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ---------- INITIALIZE ----------
window.onload = () => {
    loadProducts();
    displayProductGrid();
    displayMyProducts();
    displayProductDetail();
    setupAddProductForm();
    displayAdminStats();
    displayAllProductsForAdmin();
    setupFakeLogin();
};