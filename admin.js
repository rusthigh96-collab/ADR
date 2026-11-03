
const db = window.supabase.createClient(
    window.ADR_SUPABASE_URL,
    window.ADR_SUPABASE_KEY
);

const loginForm = document.getElementById("login-form");
const loginPanel = document.getElementById("login-panel");
const dashboard = document.getElementById("admin-dashboard");
const loginStatus = document.getElementById("login-status");
const productForm = document.getElementById("product-form");
const statusMessage = document.getElementById("status");
const productsContainer = document.getElementById("admin-products");

let currentImageUrl = "";
let saving = false;

// ELEMENTOS
const saveButton = document.getElementById("save-button");
const cancelButton = document.getElementById("cancel-edit");

// MENSAGENS
function showStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.dataset.type = type;
}

// LOGIN
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const button = document.getElementById("login-button");
    button.disabled = true;
    loginStatus.textContent = "Entrando...";

    try {
        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value;

        const { data, error } = await db.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        await checkAdmin(data.user);

    } catch (error) {
        loginStatus.textContent = "Erro: " + error.message;
    } finally {
        button.disabled = false;
    }
});

// VERIFICAR ADMINISTRADOR
async function checkAdmin(user) {
    const { data: profile, error } = await db
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (error || !profile || profile.role !== "admin") {
        await db.auth.signOut();
        loginStatus.textContent =
            "Acesso permitido somente para administradores.";
        return;
    }

    loginPanel.hidden = true;
    dashboard.hidden = false;

    document.getElementById("admin-user").textContent = user.email;

    await loadProducts();
}

// SAIR
document.getElementById("logout-button").addEventListener("click", async () => {
    await db.auth.signOut();
    location.reload();
});

// CARREGAR PRODUTOS
async function loadProducts() {
    productsContainer.textContent = "Carregando produtos...";

    const { data, error } = await db
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        productsContainer.textContent =
            "Erro ao carregar: " + error.message;
        return;
    }

    productsContainer.innerHTML = "";

    if (!data || data.length === 0) {
        productsContainer.textContent = "Nenhum produto cadastrado.";
        return;
    }

    data.forEach(product => {
        const item = document.createElement("div");
        item.className = "admin-product";

        const image = document.createElement("img");
        image.src = product.image_url || "";
        image.alt = product.name;
        image.style.cssText =
            "width:80px;height:80px;object-fit:cover;";

        const info = document.createElement("div");

        const name = document.createElement("h3");
        name.textContent = product.name;

        const price = document.createElement("p");
        price.textContent = Number(product.price).toLocaleString(
            "pt-BR",
            { style: "currency", currency: "BRL" }
        );

        const category = document.createElement("p");
        category.textContent = product.category || "";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "edit-button";
        editButton.textContent = "Editar";

        editButton.addEventListener("click", () => {
            editProduct(product);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-button";
        deleteButton.textContent = "Excluir";

        deleteButton.addEventListener("click", () => {
            deleteProduct(product);
        });

        info.append(name, price, category, editButton, deleteButton);
        item.append(image, info);
        productsContainer.appendChild(item);
    });
}

// LIMPAR FORMULÁRIO
function resetProductForm() {
    productForm.reset();
    currentImageUrl = "";

    document.getElementById("product-id").value = "";
    document.getElementById("image-preview").innerHTML = "";

    document.getElementById("form-title").textContent =
        "Adicionar produto";

    cancelButton.hidden = true;
    saveButton.textContent = "Salvar produto";

    showStatus("");
}

// CADASTRAR OU EDITAR
productForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (saving) return;

    saving = true;
    saveButton.disabled = true;
    showStatus("Salvando produto...");

    let uploadedPath = null;

    try {
        const id = document.getElementById("product-id").value;
        const imageFile = document.getElementById("image").files[0];

        let imageUrl = currentImageUrl;

        if (imageFile) {
            if (imageFile.size > 5 * 1024 * 1024) {
                throw new Error("A imagem deve ter no máximo 5 MB.");
            }

            if (!["image/jpeg", "image/png", "image/webp"].includes(imageFile.type)) {
                throw new Error("Use uma imagem JPG, PNG ou WEBP.");
            }

            const extension = imageFile.name.split(".").pop().toLowerCase();
            const fileName = `${crypto.randomUUID()}.${extension}`;

            const { error: uploadError } = await db.storage
                .from("product-images")
                .upload(fileName, imageFile, {
                    upsert: false,
                    contentType: imageFile.type
                });

            if (uploadError) throw uploadError;

            uploadedPath = fileName;

            const { data: publicData } = db.storage
                .from("product-images")
                .getPublicUrl(fileName);

            imageUrl = publicData.publicUrl;
        }

        if (!imageUrl) {
            throw new Error("Selecione uma imagem para o produto.");
        }

        const affiliateLink =
            document.getElementById("affiliate").value.trim();

        let parsedLink;

        try {
            parsedLink = new URL(affiliateLink);
        } catch {
            throw new Error("Informe um link válido da Shopee.");
        }

        const host = parsedLink.hostname.toLowerCase();

        if (
            parsedLink.protocol !== "https:" ||
            !(host === "shopee.com.br" ||
              host.endsWith(".shopee.com.br") ||
              host === "s.shopee.com.br")
        ) {
            throw new Error("Informe um link válido da Shopee.");
        }

        const product = {
            name: document.getElementById("name").value.trim(),
            category: document.getElementById("category").value,
            price: Number(document.getElementById("price").value),
            tag: document.getElementById("tag").value.trim(),
            affiliate_url: affiliateLink,
            image_url: imageUrl,
            is_active: true
        };

        if (!product.name || !Number.isFinite(product.price) || product.price <= 0) {
            throw new Error("Confira o nome e o preço do produto.");
        }

        let result;

        if (id) {
            result = await db
                .from("products")
                .update(product)
                .eq("id", id);
        } else {
            result = await db
                .from("products")
                .insert([product]);
        }

        if (result.error) throw result.error;

        showStatus(
            id ? "Produto atualizado com sucesso!" : "Produto cadastrado com sucesso!",
            "success"
        );

        resetProductForm();
        await loadProducts();

    } catch (error) {
        // Remove imagem recém-enviada se o cadastro/edição falhar.
        if (uploadedPath) {
            await db.storage
                .from("product-images")
                .remove([uploadedPath]);
        }

        showStatus("Erro: " + error.message, "error");

    } finally {
        saving = false;
        saveButton.disabled = false;
    }
});

// EDITAR PRODUTO
function editProduct(product) {
    document.getElementById("product-id").value = product.id;
    document.getElementById("name").value = product.name;
    document.getElementById("category").value = product.category;
    document.getElementById("price").value = product.price;
    document.getElementById("tag").value = product.tag || "";
    document.getElementById("affiliate").value = product.affiliate_url;

    currentImageUrl = product.image_url || "";

    const preview = document.getElementById("image-preview");
    preview.innerHTML = "";

    if (currentImageUrl) {
        const image = document.createElement("img");
        image.src = currentImageUrl;
        image.alt = "Imagem atual do produto";
        image.style.cssText =
            "width:120px;height:120px;object-fit:cover;";
        preview.appendChild(image);
    }

    document.getElementById("form-title").textContent = "Editar produto";
    saveButton.textContent = "Salvar alterações";
    cancelButton.hidden = false;

    showStatus("Editando: " + product.name);

    window.scrollTo({ top: 0, behavior: "smooth" });
}

// CANCELAR EDIÇÃO
cancelButton.addEventListener("click", resetProductForm);

// EXCLUIR PRODUTO
async function deleteProduct(product) {
    const confirmed = confirm(
        `Tem certeza que deseja excluir "${product.name}"?`
    );

    if (!confirmed) return;

    showStatus("Excluindo produto...");

    const { error } = await db
        .from("products")
        .delete()
        .eq("id", product.id);

    if (error) {
        showStatus("Erro ao excluir: " + error.message, "error");
        return;
    }

    if (document.getElementById("product-id").value === product.id) {
        resetProductForm();
    }

    showStatus("Produto excluído com sucesso!", "success");
    await loadProducts();
}

// VERIFICAR SESSÃO
async function checkSession() {
    const { data, error } = await db.auth.getSession();

    if (error) {
        loginStatus.textContent = "Erro ao verificar sessão.";
        return;
    }

    if (data.session) {
        await checkAdmin(data.session.user);
    }
}

checkSession();
