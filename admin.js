const DB_NAME = "adrStoreDB";
const STORE_NAME = "products";
const form = document.getElementById("product-form");
const list = document.getElementById("admin-products");
const statusLine = document.getElementById("status");
const imageInput = document.getElementById("image");
const preview = document.getElementById("image-preview");
let selectedImageData = "";

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE_NAME)) {
                request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
async function allProducts() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const req = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
        req.onsuccess = () => { db.close(); resolve(req.result); };
        req.onerror = () => { db.close(); reject(req.error); };
    });
}
async function putProduct(product) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const req = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(product);
        req.onsuccess = () => { db.close(); resolve(); };
        req.onerror = () => { db.close(); reject(req.error); };
    });
}
async function deleteProduct(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const req = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id);
        req.onsuccess = () => { db.close(); resolve(); };
        req.onerror = () => { db.close(); reject(req.error); };
    });
}
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
}
function showStatus(message, isError = false) {
    statusLine.textContent = message;
    statusLine.style.color = isError ? "#ff9b9b" : "#c6ff00";
}
imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        imageInput.value = "";
        showStatus("Escolha uma imagem JPG, PNG ou WEBP.", true);
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        imageInput.value = "";
        showStatus("A imagem passou de 5 MB. Escolha uma foto menor.", true);
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        selectedImageData = reader.result;
        preview.src = selectedImageData;
        preview.style.display = "block";
        showStatus("Foto carregada. Agora salve o produto.");
    };
    reader.onerror = () => showStatus("Não foi possível ler essa imagem.", true);
    reader.readAsDataURL(file);
});
function resetForm() {
    form.reset();
    document.getElementById("product-id").value = "";
    selectedImageData = "";
    preview.src = "";
    preview.style.display = "none";
    document.getElementById("form-title").innerHTML = 'ADD NEW <span>PRODUCT.</span>';
    document.getElementById("save-button").textContent = "SAVE PRODUCT ↗";
    document.getElementById("cancel-edit").hidden = true;
}
async function renderAdminProducts() {
    const products = await allProducts();
    if (!products.length) {
        list.innerHTML = '<p class="admin-note">Nenhum produto cadastrado ainda.</p>';
        return;
    }
    list.innerHTML = products.map(product => `
        <article class="admin-product">
            <img src="${escapeHTML(product.image || "")}" alt="">
            <div class="admin-product-info">
                <strong>${escapeHTML(product.name)}</strong>
                <span>R$ ${Number(product.price).toFixed(2).replace(".", ",")} · ${escapeHTML(product.category)}</span>
                <button class="admin-secondary edit-product" data-id="${escapeHTML(product.id)}" type="button">EDITAR</button>
                <button class="delete-button remove-product" data-id="${escapeHTML(product.id)}" type="button">EXCLUIR</button>
            </div>
        </article>`).join("");
    list.querySelectorAll(".edit-product").forEach(button => button.addEventListener("click", () => editProduct(button.dataset.id)));
    list.querySelectorAll(".remove-product").forEach(button => button.addEventListener("click", () => removeProduct(button.dataset.id)));
}
async function editProduct(id) {
    const product = (await allProducts()).find(item => item.id === id);
    if (!product) return;
    document.getElementById("product-id").value = product.id;
    document.getElementById("name").value = product.name;
    document.getElementById("category").value = product.category;
    document.getElementById("price").value = product.price;
    document.getElementById("tag").value = product.tag || "";
    document.getElementById("affiliate").value = product.affiliateLink || "";
    selectedImageData = product.image || "";
    if (selectedImageData) {
        preview.src = selectedImageData;
        preview.style.display = "block";
    } else {
        preview.style.display = "none";
    }
    document.getElementById("form-title").innerHTML = 'EDIT <span>PRODUCT.</span>';
    document.getElementById("save-button").textContent = "UPDATE PRODUCT ↗";
    document.getElementById("cancel-edit").hidden = false;
    showStatus("Editando produto. Se não escolher outra foto, a imagem atual será mantida.");
    window.scrollTo({ top: 0, behavior: "smooth" });
}
async function removeProduct(id) {
    const confirmed = window.confirm("Tem certeza que deseja excluir este produto do catálogo?");
    if (!confirmed) return;
    await deleteProduct(id);
    await renderAdminProducts();
    showStatus("Produto excluído do catálogo.");
}
form.addEventListener("submit", async event => {
    event.preventDefault();
    const id = document.getElementById("product-id").value || `adr-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const oldProduct = (await allProducts()).find(item => item.id === id);
    const name = document.getElementById("name").value.trim();
    const price = Number(document.getElementById("price").value);
    const affiliateLink = document.getElementById("affiliate").value.trim();
    if (!/^https:\/\/(s\.shopee\.com\.br|shopee\.com\.br|www\.shopee\.com\.br)\//i.test(affiliateLink)) {
        showStatus("Cole um link HTTPS válido da Shopee.", true);
        return;
    }
    const image = selectedImageData || oldProduct?.image || "";
    if (!image) {
        showStatus("Selecione uma foto para o produto.", true);
        return;
    }
    const product = {
        id,
        name,
        category: document.getElementById("category").value,
        price,
        tag: document.getElementById("tag").value.trim() || "ADR SELECT",
        affiliateLink,
        image
    };
    try {
        await putProduct(product);
        resetForm();
        await renderAdminProducts();
        showStatus("Produto salvo! Atualize a página da loja ADR para conferir.");
    } catch (error) {
        console.error(error);
        showStatus("Não foi possível salvar. Tente uma imagem menor ou libere espaço no navegador.", true);
    }
});
document.getElementById("cancel-edit").addEventListener("click", resetForm);
renderAdminProducts().catch(error => {
    console.error(error);
    showStatus("Erro ao abrir o banco local deste navegador.", true);
});
