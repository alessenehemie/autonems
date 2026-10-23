/* Thème jour / nuit du tableau de bord AutoNems.
   - Le bouton est maintenant positionné en haut à droite de l'écran, 
     en dehors du menu latéral et des onglets. */
(function () {
    var KEY = 'autonems_admin_theme';
    var root = document.documentElement;

    function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
    function write(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* navigation privée : ignoré */ } }

    function apply(theme) {
        root.setAttribute('data-theme', theme);
        var meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
        meta.content = theme === 'light' ? '#eaf1f8' : '#0b1120';
        var btn = document.getElementById('themeToggle');
        if (btn) {
            var light = theme === 'light';
            btn.setAttribute('aria-pressed', light ? 'true' : 'false');
            btn.title = light ? 'Passer en mode nuit' : 'Passer en mode jour';
            btn.querySelector('.tt-icon').textContent = light ? '🌙' : '☀️';
            btn.querySelector('.tt-label').textContent = light ? 'Mode nuit' : 'Mode jour';
        }
    }

    var current = read() === 'light' ? 'light' : 'dark';
    apply(current);

    document.addEventListener('DOMContentLoaded', function () {
        if (document.getElementById('themeToggle')) return;
        
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'themeToggle';
        btn.className = 'theme-toggle';
        
        /* Styles pour positionner le bouton en haut à droite, hors des onglets */
        btn.style.position = 'fixed';
        btn.style.top = '20px';
        btn.style.right = '25px';
        btn.style.zIndex = '99999';
        btn.style.width = 'auto';
        btn.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
        
        btn.innerHTML = '<span class="tt-icon" aria-hidden="true"></span><span class="tt-label"></span>';
        
        // On l'ajoute directement au body et non plus à la sidebar
        document.body.appendChild(btn);
        
        apply(current);
        
        btn.addEventListener('click', function () {
            current = current === 'light' ? 'dark' : 'light';
            root.classList.add('theme-anim');
            apply(current);
            write(current);
            setTimeout(function () { root.classList.remove('theme-anim'); }, 450);
        });
    });
})();