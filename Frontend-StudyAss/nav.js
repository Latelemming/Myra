// nav.js
// Shared bottom navigation bar. Include this file on every page and add
// <div id="bottom-nav-placeholder"></div> where you want the nav to appear.

document.addEventListener("DOMContentLoaded", function () {

    const nav = document.createElement("div");
    nav.className = "bottom-nav";

    nav.innerHTML = `
        <a href="Forum.html" data-page="forum">
            <i class="fa-solid fa-house"></i>
        </a>

        <a href="Scan.html" data-page="scan">
            <i class="fa-solid fa-qrcode"></i>
        </a>

        <a href="Map.html" data-page="map">
            <i class="fa-solid fa-location-dot"></i>
        </a>

        <a href="AI.html" data-page="translate">
            <i class="fa-solid fa-language"></i>
        </a>

        <a href="Library.html" data-page="library">
            <i class="fa-solid fa-book-open"></i>
        </a>

        <a href="Groups.html" data-page="groups">
            <i class="fa-solid fa-user-group"></i>
        </a>
    `;

    const placeholder = document.getElementById("bottom-nav-placeholder");

    if (placeholder) {
        placeholder.replaceWith(nav);
    } else {
        document.body.appendChild(nav);
    }

    // Highlight the link matching the current page's <body data-page="...">
    const currentPage = document.body.dataset.page;

    if (currentPage) {
        const activeLink = nav.querySelector(`[data-page="${currentPage}"]`);
        if (activeLink) activeLink.classList.add("active");
    }

});
