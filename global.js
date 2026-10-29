console.log('IT’S ALIVE!');


function $$(selector, context = document) {
    return Array.from(context.querySelectorAll(selector));
}

let pages = [
    { url: '', title: 'Home' },
    { url: 'projects/', title: 'Projects' },
    { url: 'Resume/', title: 'Resume'},
    { url: 'contact/', title: 'Contact'},
    { url: 'https://github.com/e2pak', title: 'Github'}
];

let nav = document.createElement('nav');
document.body.prepend(nav);

const BASE_PATH =
    location.hostname === 'localhost' || location.hostname === '127.0.0.1'
        ? '/' // Local server
        : '/portfolio/'; // GitHub Pages repo name

for (let p of pages) {
    let url = p.url;
    let title = p.title;

    // Format the URL before assigning it to the anchor element
    url = !url.startsWith('http') ? BASE_PATH + url : url;

    let a = document.createElement('a');
    a.href = url;
    a.textContent = title;

    // Check if the link is external using the newly created anchor's properties
    if (a.host !== location.host) {
        a.target = "_blank";
    }

    // Highlight the current page
    a.classList.toggle(
        'current',
        a.host === location.host && a.pathname === location.pathname,
    );

    nav.append(a);
}

document.body.insertAdjacentHTML(
  'afterbegin',
  `
    <label class="color-scheme">
        Theme:
        <select id="theme-switcher">
            <option value="light dark">Automatic</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
        </select>
    </label>`
);

// Get a reference to the <select> element you just added
const select = document.querySelector('.color-scheme select');

// Read the user's preference from localStorage when the page loads
if ("colorScheme" in localStorage) {
  // Apply the saved theme to the HTML element
  document.documentElement.style.colorScheme = localStorage.colorScheme;
  
  // Update the dropdown menu so it matches the saved theme
  select.value = localStorage.colorScheme;
}

// 2. Save the preference when the user changes it
select.addEventListener('input', function (event) {
  console.log('color scheme changed to', event.target.value);
  
  // Apply the newly selected theme
  document.documentElement.style.colorScheme = event.target.value;
  
  // Save it to localStorage so it persists on refresh
  localStorage.colorScheme = event.target.value;
});

export async function fetchJSON(url) {
  try {
    // Fetch the JSON file from the given URL
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching or parsing JSON data:', error);
  }
}

export function renderProjects(project, containerElement, headingLevel = 'h2') {
  // Validate the headingLevel parameter
  const validHeadings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  if (!validHeadings.includes(headingLevel)) {
    console.warn(`Invalid heading level "${headingLevel}". Falling back to "h2".`);
    headingLevel = 'h2';
  }

  containerElement.innerHTML = '';
  for (let p of project) {
  const article = document.createElement('article');

  // Use template literals to dynamically inject the heading tag
  article.innerHTML = `
    <${headingLevel}>${p.title}</${headingLevel}>
    <img src="${p.image}" alt="${p.title}">
    <p>${p.description}</p>
  `;
  
  containerElement.appendChild(article);
  }
}

export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${username}`);
}
