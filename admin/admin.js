const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.hidden = true;
        
        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value;

        try {
            // Correction du fetch : URL en premier, puis un seul objet d'options contenant le body
            const response = await fetch('../api/admin_login.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                document.getElementById('adminPassword').value = '';
                // Redirection vers le tableau de bord
                window.location.href = 'dashboard.html';
            } else {
                loginError.textContent = data.message || 'Email ou mot de passe incorrect.';
                loginError.hidden = false;
            }
        } catch (err) {
            console.error('Erreur :', err);
            loginError.textContent = 'Erreur de connexion au serveur.';
            loginError.hidden = false;
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Gestion du changement d'onglets (Navigation Sidebar)
    const tabs = document.querySelectorAll('.tab-link');
    const sections = document.querySelectorAll('.admin-section');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = tab.getAttribute('data-target');

            tabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // 2. Gestion du bouton de Déconnexion
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await fetch('../api/admin_logout.php');
                window.location.href = 'index.html';
            } catch (err) {
                console.error('Erreur lors de la déconnexion', err);
                window.location.href = 'index.html';
            }
        });
    }

    // 3. Simulation du chargement du stock
    setTimeout(() => {
        const carListBody = document.getElementById('carListBody');
        if (carListBody) {
            carListBody.innerHTML = `
                <tr>
                    <td>Corolla</td>
                    <td>Toyota</td>
                    <td>Location</td>
                    <td>35 000 FCFA / jour</td>
                    <td>
                        <button style="background:#10b981; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Modifier</button>
                        <button style="background:#ef4444; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Supprimer</button>
                    </td>
                </tr>
            `;
        }
    }, 1000);
});