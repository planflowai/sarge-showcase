/**
 * Project Templates - Starter templates for new projects
 */

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  files: TemplateFile[];
}

export interface TemplateFile {
  path: string;
  content: string;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'blank-html',
    name: 'Blank HTML',
    description: 'Empty HTML5 boilerplate',
    icon: '📄',
    files: [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Project</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <h1>Hello World</h1>
  <p>Start building your project here.</p>

  <script src="main.js"></script>
</body>
</html>`,
      },
      {
        path: 'styles.css',
        content: `/* Main Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

h1 {
  margin-bottom: 1rem;
  color: #333;
}

p {
  color: #666;
}
`,
      },
      {
        path: 'main.js',
        content: `// Main JavaScript
console.log('Project loaded!');
`,
      },
    ],
  },
  {
    id: 'landing-page',
    name: 'Landing Page',
    description: 'Modern landing page with hero, features, and footer',
    icon: '🚀',
    files: [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Landing Page</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
  <!-- Navigation -->
  <nav class="bg-white shadow-sm">
    <div class="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
      <div class="text-xl font-bold text-indigo-600">Logo</div>
      <div class="hidden md:flex space-x-6">
        <a href="#features" class="text-gray-600 hover:text-indigo-600">Features</a>
        <a href="#pricing" class="text-gray-600 hover:text-indigo-600">Pricing</a>
        <a href="#contact" class="text-gray-600 hover:text-indigo-600">Contact</a>
      </div>
      <button class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
        Get Started
      </button>
    </div>
  </nav>

  <!-- Hero Section -->
  <section class="py-20 px-4">
    <div class="max-w-4xl mx-auto text-center">
      <h1 class="text-5xl font-bold text-gray-900 mb-6">
        Build Something Amazing
      </h1>
      <p class="text-xl text-gray-600 mb-8">
        Your perfect solution for creating modern web applications with ease.
      </p>
      <div class="flex justify-center gap-4">
        <button class="bg-indigo-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-indigo-700">
          Start Free Trial
        </button>
        <button class="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg text-lg hover:bg-gray-100">
          Learn More
        </button>
      </div>
    </div>
  </section>

  <!-- Features Section -->
  <section id="features" class="py-20 bg-white">
    <div class="max-w-6xl mx-auto px-4">
      <h2 class="text-3xl font-bold text-center mb-12">Features</h2>
      <div class="grid md:grid-cols-3 gap-8">
        <div class="text-center p-6">
          <div class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span class="text-2xl">⚡</span>
          </div>
          <h3 class="text-xl font-semibold mb-2">Fast</h3>
          <p class="text-gray-600">Lightning fast performance out of the box.</p>
        </div>
        <div class="text-center p-6">
          <div class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span class="text-2xl">🎨</span>
          </div>
          <h3 class="text-xl font-semibold mb-2">Beautiful</h3>
          <p class="text-gray-600">Stunning designs that look great everywhere.</p>
        </div>
        <div class="text-center p-6">
          <div class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span class="text-2xl">🔒</span>
          </div>
          <h3 class="text-xl font-semibold mb-2">Secure</h3>
          <p class="text-gray-600">Enterprise-grade security built in.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="bg-gray-900 text-white py-12">
    <div class="max-w-6xl mx-auto px-4 text-center">
      <p class="text-gray-400">© 2024 Your Company. All rights reserved.</p>
    </div>
  </footer>
</body>
</html>`,
      },
    ],
  },
  {
    id: 'multi-page',
    name: 'Multi-Page Site',
    description: 'Website with multiple pages and shared navigation',
    icon: '📚',
    files: [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Home - My Website</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <nav class="navbar">
    <a href="index.html" class="logo">MySite</a>
    <ul class="nav-links">
      <li><a href="index.html" class="active">Home</a></li>
      <li><a href="about.html">About</a></li>
      <li><a href="contact.html">Contact</a></li>
    </ul>
  </nav>

  <main class="container">
    <h1>Welcome Home</h1>
    <p>This is the home page of your multi-page website.</p>
  </main>

  <footer>
    <p>© 2024 My Website</p>
  </footer>
</body>
</html>`,
      },
      {
        path: 'about.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>About - My Website</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <nav class="navbar">
    <a href="index.html" class="logo">MySite</a>
    <ul class="nav-links">
      <li><a href="index.html">Home</a></li>
      <li><a href="about.html" class="active">About</a></li>
      <li><a href="contact.html">Contact</a></li>
    </ul>
  </nav>

  <main class="container">
    <h1>About Us</h1>
    <p>Learn more about our company and mission.</p>
  </main>

  <footer>
    <p>© 2024 My Website</p>
  </footer>
</body>
</html>`,
      },
      {
        path: 'contact.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contact - My Website</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <nav class="navbar">
    <a href="index.html" class="logo">MySite</a>
    <ul class="nav-links">
      <li><a href="index.html">Home</a></li>
      <li><a href="about.html">About</a></li>
      <li><a href="contact.html" class="active">Contact</a></li>
    </ul>
  </nav>

  <main class="container">
    <h1>Contact Us</h1>
    <form class="contact-form">
      <input type="text" placeholder="Name" required>
      <input type="email" placeholder="Email" required>
      <textarea placeholder="Message" rows="5" required></textarea>
      <button type="submit">Send Message</button>
    </form>
  </main>

  <footer>
    <p>© 2024 My Website</p>
  </footer>
</body>
</html>`,
      },
      {
        path: 'styles.css',
        content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.navbar {
  background: #333;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  color: white;
  text-decoration: none;
  font-size: 1.5rem;
  font-weight: bold;
}

.nav-links {
  list-style: none;
  display: flex;
  gap: 2rem;
}

.nav-links a {
  color: #ccc;
  text-decoration: none;
}

.nav-links a.active,
.nav-links a:hover {
  color: white;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  flex: 1;
}

h1 {
  margin-bottom: 1rem;
}

.contact-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 400px;
}

.contact-form input,
.contact-form textarea {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.contact-form button {
  padding: 0.75rem;
  background: #333;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

footer {
  background: #333;
  color: white;
  text-align: center;
  padding: 1rem;
}
`,
      },
    ],
  },
  {
    id: 'react-app',
    name: 'React App',
    description: 'Single-page React application',
    icon: '⚛️',
    files: [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>React App</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div id="root"></div>

  <script type="text/babel">
    const { useState, useEffect } = React;

    function App() {
      const [count, setCount] = useState(0);

      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="bg-white p-8 rounded-xl shadow-lg text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">
              React Counter
            </h1>
            <p className="text-6xl font-bold text-indigo-600 mb-6">
              {count}
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setCount(c => c - 1)}
                className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                -
              </button>
              <button
                onClick={() => setCount(0)}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Reset
              </button>
              <button
                onClick={() => setCount(c => c + 1)}
                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                +
              </button>
            </div>
          </div>
        </div>
      );
    }

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  </script>
</body>
</html>`,
      },
    ],
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Admin dashboard with sidebar and stats',
    icon: '📊',
    files: [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100">
  <div class="flex h-screen">
    <!-- Sidebar -->
    <aside class="w-64 bg-gray-900 text-white">
      <div class="p-4 border-b border-gray-700">
        <h1 class="text-xl font-bold">Dashboard</h1>
      </div>
      <nav class="p-4">
        <ul class="space-y-2">
          <li>
            <a href="#" class="flex items-center gap-3 px-4 py-2 bg-gray-800 rounded-lg">
              <span>📊</span> Overview
            </a>
          </li>
          <li>
            <a href="#" class="flex items-center gap-3 px-4 py-2 hover:bg-gray-800 rounded-lg">
              <span>👥</span> Users
            </a>
          </li>
          <li>
            <a href="#" class="flex items-center gap-3 px-4 py-2 hover:bg-gray-800 rounded-lg">
              <span>📦</span> Products
            </a>
          </li>
          <li>
            <a href="#" class="flex items-center gap-3 px-4 py-2 hover:bg-gray-800 rounded-lg">
              <span>⚙️</span> Settings
            </a>
          </li>
        </ul>
      </nav>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 overflow-auto">
      <!-- Header -->
      <header class="bg-white shadow-sm p-4 flex justify-between items-center">
        <h2 class="text-xl font-semibold">Overview</h2>
        <div class="flex items-center gap-4">
          <span class="text-gray-600">Welcome, Admin</span>
          <div class="w-10 h-10 bg-indigo-500 rounded-full"></div>
        </div>
      </header>

      <!-- Stats -->
      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div class="bg-white p-6 rounded-xl shadow-sm">
            <p class="text-gray-500 text-sm">Total Users</p>
            <p class="text-3xl font-bold">12,345</p>
            <p class="text-green-500 text-sm">+12% from last month</p>
          </div>
          <div class="bg-white p-6 rounded-xl shadow-sm">
            <p class="text-gray-500 text-sm">Revenue</p>
            <p class="text-3xl font-bold">$54,321</p>
            <p class="text-green-500 text-sm">+8% from last month</p>
          </div>
          <div class="bg-white p-6 rounded-xl shadow-sm">
            <p class="text-gray-500 text-sm">Orders</p>
            <p class="text-3xl font-bold">1,234</p>
            <p class="text-red-500 text-sm">-3% from last month</p>
          </div>
          <div class="bg-white p-6 rounded-xl shadow-sm">
            <p class="text-gray-500 text-sm">Conversion</p>
            <p class="text-3xl font-bold">3.2%</p>
            <p class="text-green-500 text-sm">+0.5% from last month</p>
          </div>
        </div>

        <!-- Recent Activity -->
        <div class="bg-white rounded-xl shadow-sm p-6">
          <h3 class="text-lg font-semibold mb-4">Recent Activity</h3>
          <div class="space-y-4">
            <div class="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">✓</div>
              <div>
                <p class="font-medium">New user registered</p>
                <p class="text-sm text-gray-500">2 minutes ago</p>
              </div>
            </div>
            <div class="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">📦</div>
              <div>
                <p class="font-medium">Order #1234 shipped</p>
                <p class="text-sm text-gray-500">15 minutes ago</p>
              </div>
            </div>
            <div class="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div class="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">⭐</div>
              <div>
                <p class="font-medium">New review received</p>
                <p class="text-sm text-gray-500">1 hour ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</body>
</html>`,
      },
    ],
  },
  {
    id: 'blog',
    name: 'Blog',
    description: 'Blog layout with posts and sidebar',
    icon: '✍️',
    files: [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Blog</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
  <!-- Header -->
  <header class="bg-white shadow-sm">
    <div class="max-w-6xl mx-auto px-4 py-6">
      <h1 class="text-3xl font-bold text-gray-900">My Blog</h1>
      <p class="text-gray-600">Thoughts, stories, and ideas</p>
    </div>
  </header>

  <main class="max-w-6xl mx-auto px-4 py-8">
    <div class="grid md:grid-cols-3 gap-8">
      <!-- Posts -->
      <div class="md:col-span-2 space-y-8">
        <!-- Featured Post -->
        <article class="bg-white rounded-xl shadow-sm overflow-hidden">
          <div class="h-64 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
          <div class="p-6">
            <span class="text-indigo-600 text-sm font-medium">Featured</span>
            <h2 class="text-2xl font-bold mt-2 mb-3">Getting Started with Web Development</h2>
            <p class="text-gray-600 mb-4">Learn the fundamentals of HTML, CSS, and JavaScript to start your journey...</p>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-gray-300 rounded-full"></div>
              <div>
                <p class="font-medium">John Doe</p>
                <p class="text-sm text-gray-500">Jan 15, 2024</p>
              </div>
            </div>
          </div>
        </article>

        <!-- Post Grid -->
        <div class="grid sm:grid-cols-2 gap-6">
          <article class="bg-white rounded-xl shadow-sm overflow-hidden">
            <div class="h-40 bg-gradient-to-r from-green-400 to-cyan-500"></div>
            <div class="p-4">
              <h3 class="font-bold mb-2">CSS Grid Layout</h3>
              <p class="text-sm text-gray-600">Master the art of CSS Grid...</p>
            </div>
          </article>
          <article class="bg-white rounded-xl shadow-sm overflow-hidden">
            <div class="h-40 bg-gradient-to-r from-orange-400 to-pink-500"></div>
            <div class="p-4">
              <h3 class="font-bold mb-2">React Hooks Guide</h3>
              <p class="text-sm text-gray-600">Everything about React Hooks...</p>
            </div>
          </article>
        </div>
      </div>

      <!-- Sidebar -->
      <aside class="space-y-6">
        <div class="bg-white rounded-xl shadow-sm p-6">
          <h3 class="font-bold mb-4">Categories</h3>
          <ul class="space-y-2">
            <li><a href="#" class="text-gray-600 hover:text-indigo-600">HTML (5)</a></li>
            <li><a href="#" class="text-gray-600 hover:text-indigo-600">CSS (8)</a></li>
            <li><a href="#" class="text-gray-600 hover:text-indigo-600">JavaScript (12)</a></li>
            <li><a href="#" class="text-gray-600 hover:text-indigo-600">React (7)</a></li>
          </ul>
        </div>

        <div class="bg-white rounded-xl shadow-sm p-6">
          <h3 class="font-bold mb-4">Newsletter</h3>
          <p class="text-sm text-gray-600 mb-4">Get the latest posts in your inbox.</p>
          <input type="email" placeholder="your@email.com" class="w-full px-3 py-2 border rounded-lg mb-2">
          <button class="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700">
            Subscribe
          </button>
        </div>
      </aside>
    </div>
  </main>
</body>
</html>`,
      },
    ],
  },
];

// ============================================================================
// CLIENT PAGE TEMPLATES — for intake-driven builds
// ============================================================================

export const CLIENT_PAGE_TEMPLATES: ProjectTemplate[] = [
  {
    id: "tpl-gallery",
    name: "Gallery Page",
    description: "Masonry grid with lightbox modal, category filters, lazy loading",
    icon: "🖼️",
    files: [{
      path: "gallery.html",
      content: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Gallery - {{BUSINESS_NAME}}</title><style>:root{--primary:#14b8a6;--secondary:#8b5cf6;--accent:#ec4899;--bg:#060b18;--card:#111827;--text:#f0f2f5}*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}.gallery-header{text-align:center;padding:4rem 2rem 2rem}.gallery-header h1{font-size:2.5rem;font-weight:800;margin-bottom:.5rem}.gallery-header p{color:#94a3b8;font-size:1.1rem}.filters{display:flex;gap:.5rem;justify-content:center;padding:1rem 2rem;flex-wrap:wrap}.filter-btn{padding:.5rem 1.25rem;border:1px solid #334155;background:transparent;color:#94a3b8;border-radius:2rem;cursor:pointer;font-size:.9rem;font-weight:600;transition:all .2s}.filter-btn.active,.filter-btn:hover{background:var(--primary);color:#fff;border-color:var(--primary)}.gallery-grid{columns:3;column-gap:1rem;padding:2rem;max-width:1200px;margin:0 auto}@media(max-width:768px){.gallery-grid{columns:2}}@media(max-width:480px){.gallery-grid{columns:1}}.gallery-item{break-inside:avoid;margin-bottom:1rem;border-radius:.75rem;overflow:hidden;cursor:pointer;position:relative}.gallery-item img{width:100%;display:block;transition:transform .3s}.gallery-item:hover img{transform:scale(1.03)}.gallery-item .overlay{position:absolute;inset:0;background:linear-gradient(transparent 60%,rgba(0,0,0,.7));opacity:0;transition:opacity .3s;display:flex;align-items:flex-end;padding:1rem}.gallery-item:hover .overlay{opacity:1}.overlay span{color:#fff;font-weight:600;font-size:.9rem}.lightbox{position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:999;display:none;align-items:center;justify-content:center}.lightbox.open{display:flex}.lightbox img{max-width:90vw;max-height:85vh;border-radius:.5rem}.lightbox-close{position:absolute;top:1rem;right:1.5rem;color:#fff;font-size:2rem;cursor:pointer;background:none;border:none}footer{text-align:center;padding:2rem;color:#64748b;font-size:.85rem;border-top:1px solid #1e293b}</style></head><body><header class="gallery-header"><h1>Our Work</h1><p>Browse our portfolio of completed projects</p></header><div class="filters"><button class="filter-btn active" data-cat="all">All</button><button class="filter-btn" data-cat="web">Web Design</button><button class="filter-btn" data-cat="brand">Branding</button><button class="filter-btn" data-cat="photo">Photography</button></div><div class="gallery-grid" id="gallery"></div><div class="lightbox" id="lightbox" role="dialog" aria-label="Image viewer"><button class="lightbox-close" aria-label="Close">&times;</button><img src="" alt="Full size image" /></div><footer>&copy; 2026 {{BUSINESS_NAME}}. All rights reserved.</footer><script>const images=[{src:"https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600",cat:"web",title:"Modern Dashboard"},{src:"https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=600",cat:"web",title:"Landing Page"},{src:"https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600",cat:"brand",title:"Logo Design"},{src:"https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600",cat:"brand",title:"Brand Identity"},{src:"https://images.unsplash.com/photo-1504805572947-34fad45aed93?w=600",cat:"photo",title:"Product Shoot"},{src:"https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600",cat:"web",title:"Corporate Site"},{src:"https://images.unsplash.com/photo-1523726491678-bf852e717f6a?w=600",cat:"photo",title:"Event Coverage"},{src:"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600",cat:"brand",title:"Visual Identity"}];const gallery=document.getElementById("gallery");const lightbox=document.getElementById("lightbox");const lbImg=lightbox.querySelector("img");function render(cat){gallery.innerHTML="";images.filter(i=>cat==="all"||i.cat===cat).forEach(i=>{const d=document.createElement("div");d.className="gallery-item";d.setAttribute("data-cat",i.cat);d.innerHTML='<img src="'+i.src+'" alt="'+i.title+'" loading="lazy"/><div class="overlay"><span>'+i.title+"</span></div>";d.onclick=()=>{lbImg.src=i.src;lbImg.alt=i.title;lightbox.classList.add("open")};gallery.appendChild(d)})}document.querySelectorAll(".filter-btn").forEach(b=>{b.onclick=()=>{document.querySelectorAll(".filter-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active");render(b.dataset.cat)}});lightbox.querySelector(".lightbox-close").onclick=()=>lightbox.classList.remove("open");lightbox.onclick=e=>{if(e.target===lightbox)lightbox.classList.remove("open")};document.addEventListener("keydown",e=>{if(e.key==="Escape")lightbox.classList.remove("open")});render("all")</script></body></html>`,
    }],
  },
  {
    id: "tpl-testimonials",
    name: "Testimonials Page",
    description: "Client testimonials in responsive card grid with star ratings",
    icon: "⭐",
    files: [{
      path: "testimonials.html",
      content: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Testimonials - {{BUSINESS_NAME}}</title><style>:root{--primary:#14b8a6;--secondary:#8b5cf6;--bg:#060b18;--card:#111827;--text:#f0f2f5}*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}.testi-header{text-align:center;padding:4rem 2rem 2rem}.testi-header h1{font-size:2.5rem;font-weight:800;margin-bottom:.5rem}.testi-header p{color:#94a3b8;font-size:1.1rem}.testi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:1.5rem;max-width:1200px;margin:0 auto;padding:2rem}@media(max-width:480px){.testi-grid{grid-template-columns:1fr}}.testi-card{background:var(--card);border-radius:1rem;padding:2rem;border:1px solid #1e293b;transition:transform .2s,box-shadow .2s}.testi-card:hover{transform:translateY(-4px);box-shadow:0 8px 24px rgba(0,0,0,.3)}.stars{color:#f59e0b;font-size:1.2rem;margin-bottom:1rem;letter-spacing:2px}.quote{font-size:1rem;line-height:1.7;color:#cbd5e1;margin-bottom:1.5rem;font-style:italic}.quote::before{content:open-quote;font-size:2rem;color:var(--primary);font-weight:700;line-height:0;vertical-align:-.5rem;margin-right:.25rem}.quote::after{content:close-quote;font-size:2rem;color:var(--primary);font-weight:700;line-height:0;vertical-align:-.5rem;margin-left:.25rem}.client{display:flex;align-items:center;gap:.75rem}.avatar{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1rem;flex-shrink:0}.client-name{font-weight:700;font-size:.95rem;color:#f0f2f5}.client-biz{font-size:.8rem;color:#64748b}footer{text-align:center;padding:3rem 2rem;color:#64748b;font-size:.85rem;border-top:1px solid #1e293b;margin-top:2rem}</style></head><body><header class="testi-header"><h1>What Our Clients Say</h1><p>Real feedback from real businesses we've worked with</p></header><main class="testi-grid"><article class="testi-card"><div class="stars" role="img" aria-label="5 stars">★★★★★</div><p class="quote">Working with {{BUSINESS_NAME}} was incredible. They delivered exactly what we needed.</p><div class="client"><div class="avatar">JD</div><div><div class="client-name">Jane Doe</div><div class="client-biz">Acme Corp</div></div></div></article><article class="testi-card"><div class="stars" role="img" aria-label="5 stars">★★★★★</div><p class="quote">Our website went from mediocre to outstanding. The attention to detail was remarkable.</p><div class="client"><div class="avatar">MS</div><div><div class="client-name">Mike Smith</div><div class="client-biz">Smith & Co</div></div></div></article><article class="testi-card"><div class="stars" role="img" aria-label="5 stars">★★★★★</div><p class="quote">Fast, professional, and the end result exceeded our expectations. Highly recommended.</p><div class="client"><div class="avatar">AL</div><div><div class="client-name">Amy Lee</div><div class="client-biz">Bright Ideas LLC</div></div></div></article></main><footer>&copy; 2026 {{BUSINESS_NAME}}. All rights reserved.</footer></body></html>`,
    }],
  },
  {
    id: "tpl-pricing",
    name: "Pricing Page",
    description: "3-tier pricing cards with feature comparison and FAQ",
    icon: "💰",
    files: [{
      path: "pricing.html",
      content: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Pricing - {{BUSINESS_NAME}}</title><style>:root{--primary:#14b8a6;--secondary:#8b5cf6;--accent:#ec4899;--bg:#060b18;--card:#111827;--text:#f0f2f5}*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}.pricing-header{text-align:center;padding:4rem 2rem 2rem}.pricing-header h1{font-size:2.5rem;font-weight:800;margin-bottom:.5rem}.pricing-header p{color:#94a3b8;font-size:1.1rem}.pricing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem;max-width:1100px;margin:2rem auto;padding:0 2rem;align-items:start}@media(max-width:768px){.pricing-grid{grid-template-columns:1fr;max-width:440px}}.price-card{background:var(--card);border-radius:1rem;padding:2rem;border:1px solid #1e293b;position:relative;transition:transform .2s}.price-card.featured{border-color:var(--primary);transform:scale(1.04)}.price-card.featured::before{content:"Most Popular";position:absolute;top:-14px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,var(--primary),var(--secondary));color:#fff;padding:.35rem 1.25rem;border-radius:2rem;font-size:.75rem;font-weight:700}.price-card h3{font-size:1.2rem;font-weight:700;margin-bottom:.25rem}.price-card .subtitle{color:#64748b;font-size:.85rem;margin-bottom:1.5rem}.price-amount{font-size:3rem;font-weight:800;margin-bottom:.25rem}.price-amount span{font-size:1rem;font-weight:400;color:#64748b}.features{list-style:none;margin-bottom:2rem;display:flex;flex-direction:column;gap:.625rem;font-size:.9rem}.features li{display:flex;align-items:center;gap:.5rem;color:#cbd5e1}.features li::before{content:"✓";color:var(--primary);font-weight:700}.features li.no::before{content:"✗";color:#475569}.features li.no{color:#475569}.price-btn{display:block;width:100%;padding:.875rem;border:none;border-radius:.5rem;font-size:1rem;font-weight:700;cursor:pointer;text-align:center;transition:all .2s;text-decoration:none}.price-btn.primary{background:linear-gradient(135deg,var(--primary),var(--secondary));color:#fff}.price-btn.outline{background:transparent;border:1px solid #334155;color:var(--text)}.price-btn:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.3)}.faq-section{max-width:700px;margin:4rem auto;padding:0 2rem}.faq-section h2{text-align:center;font-size:1.75rem;font-weight:800;margin-bottom:2rem}details{background:var(--card);border-radius:.75rem;margin-bottom:.75rem;border:1px solid #1e293b;overflow:hidden}summary{padding:1.25rem;font-weight:700;cursor:pointer;font-size:1rem;list-style:none;display:flex;justify-content:space-between;align-items:center}summary::after{content:"+";font-size:1.5rem;color:var(--primary)}details[open] summary::after{content:"−"}details div{padding:0 1.25rem 1.25rem;color:#94a3b8;font-size:.9rem;line-height:1.6}footer{text-align:center;padding:3rem 2rem;color:#64748b;font-size:.85rem;border-top:1px solid #1e293b}</style></head><body><header class="pricing-header"><h1>Simple, Transparent Pricing</h1><p>Choose the plan that fits your business needs</p></header><div class="pricing-grid"><div class="price-card"><h3>Starter</h3><p class="subtitle">Perfect for small businesses</p><div class="price-amount">$499<span>/project</span></div><ul class="features"><li>5-page website</li><li>Mobile responsive</li><li>Basic SEO</li><li>Contact form</li><li class="no">Custom animations</li><li class="no">Priority support</li></ul><a href="#" class="price-btn outline">Get Started</a></div><div class="price-card featured"><h3>Professional</h3><p class="subtitle">Most popular for growing businesses</p><div class="price-amount">$999<span>/project</span></div><ul class="features"><li>10-page website</li><li>Mobile responsive</li><li>Advanced SEO</li><li>Contact form + Booking</li><li>Custom animations</li><li>Priority support</li></ul><a href="#" class="price-btn primary">Get Started</a></div><div class="price-card"><h3>Premium</h3><p class="subtitle">Full-service for enterprises</p><div class="price-amount">$2,499<span>/project</span></div><ul class="features"><li>Unlimited pages</li><li>Mobile responsive</li><li>Full SEO suite</li><li>All integrations</li><li>Custom animations</li><li>24/7 dedicated support</li></ul><a href="#" class="price-btn outline">Contact Sales</a></div></div><section class="faq-section"><h2>Frequently Asked Questions</h2><details><summary>What's included in each plan?</summary><div>Each plan includes design, development, testing, and deployment. Higher tiers add more pages, advanced features, and priority support.</div></details><details><summary>Do you offer revisions?</summary><div>Yes! Starter includes 2 revision rounds, Professional includes 5, and Premium includes unlimited revisions until you're satisfied.</div></details><details><summary>How long does a project take?</summary><div>Starter projects typically take 1-2 weeks, Professional 2-3 weeks, and Premium 3-4 weeks depending on complexity.</div></details><details><summary>Can I upgrade my plan later?</summary><div>Absolutely. You can upgrade at any time and we'll credit what you've already paid toward the higher tier.</div></details></section><footer>&copy; 2026 {{BUSINESS_NAME}}. All rights reserved.</footer></body></html>`,
    }],
  },
  {
    id: "tpl-faq",
    name: "FAQ Page",
    description: "Accordion FAQ with smooth expand/collapse, keyboard accessible",
    icon: "❓",
    files: [{
      path: "faq.html",
      content: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>FAQ - {{BUSINESS_NAME}}</title><style>:root{--primary:#14b8a6;--secondary:#8b5cf6;--bg:#060b18;--card:#111827;--text:#f0f2f5}*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}.faq-header{text-align:center;padding:4rem 2rem 2rem}.faq-header h1{font-size:2.5rem;font-weight:800;margin-bottom:.5rem}.faq-header p{color:#94a3b8;font-size:1.1rem}.faq-container{max-width:760px;margin:0 auto;padding:2rem}.faq-cat{font-size:1.1rem;font-weight:700;color:var(--primary);margin:2rem 0 1rem;text-transform:uppercase;letter-spacing:1px;font-size:.85rem}.faq-item{background:var(--card);border-radius:.75rem;margin-bottom:.75rem;border:1px solid #1e293b;overflow:hidden}.faq-q{width:100%;padding:1.25rem;background:none;border:none;color:var(--text);font-size:1rem;font-weight:700;text-align:left;cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-family:inherit}.faq-q:focus{outline:2px solid var(--primary);outline-offset:-2px}.faq-q .icon{font-size:1.5rem;color:var(--primary);transition:transform .2s;flex-shrink:0;margin-left:1rem}.faq-q[aria-expanded="true"] .icon{transform:rotate(45deg)}.faq-a{max-height:0;overflow:hidden;transition:max-height .3s ease}.faq-a-inner{padding:0 1.25rem 1.25rem;color:#94a3b8;font-size:.9rem;line-height:1.7}footer{text-align:center;padding:3rem 2rem;color:#64748b;font-size:.85rem;border-top:1px solid #1e293b;margin-top:2rem}</style></head><body><header class="faq-header"><h1>Frequently Asked Questions</h1><p>Find answers to common questions about {{BUSINESS_NAME}}</p></header><main class="faq-container"><div class="faq-cat">General</div><div class="faq-item"><button class="faq-q" aria-expanded="false" onclick="toggleFaq(this)">What services do you offer?<span class="icon">+</span></button><div class="faq-a"><div class="faq-a-inner">We offer a full range of services including web design, development, SEO optimization, and ongoing maintenance. Contact us at {{email}} for details.</div></div></div><div class="faq-item"><button class="faq-q" aria-expanded="false" onclick="toggleFaq(this)">How long does a typical project take?<span class="icon">+</span></button><div class="faq-a"><div class="faq-a-inner">Most projects are completed within 1-3 weeks depending on complexity. We'll provide a detailed timeline during your initial consultation.</div></div></div><div class="faq-item"><button class="faq-q" aria-expanded="false" onclick="toggleFaq(this)">Do you offer ongoing support?<span class="icon">+</span></button><div class="faq-a"><div class="faq-a-inner">Yes! We offer maintenance plans that include regular updates, security monitoring, and content changes. Call us at {{phone}} to learn more.</div></div></div><div class="faq-cat">Pricing & Payment</div><div class="faq-item"><button class="faq-q" aria-expanded="false" onclick="toggleFaq(this)">What are your payment terms?<span class="icon">+</span></button><div class="faq-a"><div class="faq-a-inner">We typically require 50% upfront and 50% upon project completion. For larger projects, we can arrange milestone-based payments.</div></div></div><div class="faq-item"><button class="faq-q" aria-expanded="false" onclick="toggleFaq(this)">Do you offer refunds?<span class="icon">+</span></button><div class="faq-a"><div class="faq-a-inner">If you're not satisfied with our work, we'll make it right. We offer revisions as part of every package to ensure your complete satisfaction.</div></div></div></main><footer>&copy; 2026 {{BUSINESS_NAME}} &middot; {{phone}} &middot; {{email}}</footer><script>function toggleFaq(btn){const a=btn.nextElementSibling;const expanded=btn.getAttribute("aria-expanded")==="true";document.querySelectorAll(".faq-q").forEach(q=>{q.setAttribute("aria-expanded","false");q.nextElementSibling.style.maxHeight=null});if(!expanded){btn.setAttribute("aria-expanded","true");a.style.maxHeight=a.scrollHeight+"px"}}</script></body></html>`,
    }],
  },
  {
    id: "tpl-booking",
    name: "Booking Page",
    description: "Scheduling page with Calendly embed placeholder and contact sidebar",
    icon: "📅",
    files: [{
      path: "booking.html",
      content: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Book an Appointment - {{BUSINESS_NAME}}</title><style>:root{--primary:#14b8a6;--secondary:#8b5cf6;--bg:#060b18;--card:#111827;--text:#f0f2f5}*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}.booking-header{text-align:center;padding:4rem 2rem 2rem}.booking-header h1{font-size:2.5rem;font-weight:800;margin-bottom:.5rem}.booking-header p{color:#94a3b8;font-size:1.1rem}.booking-layout{display:grid;grid-template-columns:1fr 320px;gap:2rem;max-width:1100px;margin:0 auto;padding:2rem}@media(max-width:768px){.booking-layout{grid-template-columns:1fr}}.calendar-embed{background:var(--card);border-radius:1rem;border:1px solid #1e293b;min-height:600px;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:2rem;text-align:center;gap:1rem}.calendar-embed .placeholder-icon{font-size:4rem}.calendar-embed p{color:#64748b;font-size:.9rem}.calendar-embed a{display:inline-block;padding:.75rem 1.5rem;background:var(--primary);color:#fff;text-decoration:none;border-radius:.5rem;font-weight:700;font-size:.9rem}.contact-sidebar{display:flex;flex-direction:column;gap:1.5rem}.info-card{background:var(--card);border-radius:1rem;padding:1.5rem;border:1px solid #1e293b}.info-card h3{font-size:1rem;font-weight:700;margin-bottom:1rem;color:var(--primary)}.info-card p,.info-card a{color:#94a3b8;font-size:.9rem;line-height:1.7;text-decoration:none}.info-card a:hover{color:var(--primary)}footer{text-align:center;padding:3rem 2rem;color:#64748b;font-size:.85rem;border-top:1px solid #1e293b;margin-top:2rem}</style></head><body><header class="booking-header"><h1>Schedule a Consultation</h1><p>Pick a time that works for you — we'll handle the rest</p></header><main class="booking-layout"><div class="calendar-embed"><div class="placeholder-icon">📅</div><p>Calendly scheduling widget loads here</p><p style="font-size:.8rem;color:#475569">Replace this with your Calendly embed code:<br><code style="color:var(--primary)">&lt;div class="calendly-inline-widget" data-url="{{CALENDLY_URL}}"&gt;&lt;/div&gt;</code></p><a href="tel:{{phone}}">Call to Book: {{phone}}</a></div><aside class="contact-sidebar"><div class="info-card"><h3>Contact Info</h3><p><strong style="color:#f0f2f5">Phone:</strong> <a href="tel:{{phone}}">{{phone}}</a></p><p><strong style="color:#f0f2f5">Email:</strong> <a href="mailto:{{email}}">{{email}}</a></p><p><strong style="color:#f0f2f5">Address:</strong> {{address}}, {{city}}, {{state}}</p></div><div class="info-card"><h3>Business Hours</h3><p>Monday - Friday: 9am - 5pm</p><p>Saturday: By appointment</p><p>Sunday: Closed</p></div><div class="info-card"><h3>What to Expect</h3><p>1. Choose a time slot above<br>2. Receive confirmation email<br>3. We'll call you at your scheduled time<br>4. Discuss your project needs</p></div></aside></main><footer>&copy; 2026 {{BUSINESS_NAME}}. All rights reserved.</footer></body></html>`,
    }],
  },
  {
    id: "tpl-showroom",
    name: "Showroom / Portfolio",
    description: "Project card grid with category filters, tags, and view buttons",
    icon: "🏛️",
    files: [{
      path: "showroom.html",
      content: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Showroom - {{BUSINESS_NAME}}</title><style>:root{--primary:#14b8a6;--secondary:#8b5cf6;--accent:#ec4899;--bg:#060b18;--card:#111827;--text:#f0f2f5}*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}.showroom-header{text-align:center;padding:4rem 2rem 2rem}.showroom-header h1{font-size:2.5rem;font-weight:800;margin-bottom:.5rem}.showroom-header p{color:#94a3b8;font-size:1.1rem}.filters{display:flex;gap:.5rem;justify-content:center;padding:1rem 2rem;flex-wrap:wrap}.filter-btn{padding:.5rem 1.25rem;border:1px solid #334155;background:transparent;color:#94a3b8;border-radius:2rem;cursor:pointer;font-size:.85rem;font-weight:600;transition:all .2s}.filter-btn.active,.filter-btn:hover{background:var(--primary);color:#fff;border-color:var(--primary)}.project-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:1.5rem;max-width:1200px;margin:0 auto;padding:2rem}@media(max-width:480px){.project-grid{grid-template-columns:1fr}}.project-card{background:var(--card);border-radius:1rem;overflow:hidden;border:1px solid #1e293b;transition:transform .2s,box-shadow .2s}.project-card:hover{transform:translateY(-4px);box-shadow:0 8px 24px rgba(0,0,0,.3)}.project-img{width:100%;height:200px;object-fit:cover}.project-body{padding:1.5rem}.project-body h3{font-size:1.1rem;font-weight:700;margin-bottom:.5rem}.project-body p{color:#94a3b8;font-size:.9rem;line-height:1.6;margin-bottom:1rem}.tags{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem}.tag{padding:.25rem .625rem;background:rgba(20,184,166,.15);color:var(--primary);border-radius:2rem;font-size:.75rem;font-weight:600}.view-btn{display:inline-flex;align-items:center;gap:.375rem;padding:.5rem 1rem;background:linear-gradient(135deg,var(--primary),var(--secondary));color:#fff;text-decoration:none;border-radius:.5rem;font-weight:600;font-size:.85rem;border:none;cursor:pointer;transition:opacity .2s}.view-btn:hover{opacity:.9}footer{text-align:center;padding:3rem 2rem;color:#64748b;font-size:.85rem;border-top:1px solid #1e293b;margin-top:2rem}</style></head><body><header class="showroom-header"><h1>Our Showroom</h1><p>Explore projects built by {{BUSINESS_NAME}}</p></header><div class="filters"><button class="filter-btn active" onclick="filterProjects('all',this)">All</button><button class="filter-btn" onclick="filterProjects('starter',this)">Starter</button><button class="filter-btn" onclick="filterProjects('professional',this)">Professional</button><button class="filter-btn" onclick="filterProjects('premium',this)">Premium</button></div><div class="project-grid" id="projects"></div><footer>&copy; 2026 {{BUSINESS_NAME}}. All rights reserved.</footer><script>const projects=[{title:"Joe's Plumbing",desc:"Professional plumbing service website with booking and SEO optimization.",img:"https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=600",tags:["Plumbing","Local SEO","Booking"],tier:"starter"},{title:"Bella's Salon",desc:"Elegant salon website with gallery, pricing, and online booking.",img:"https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600",tags:["Salon","Gallery","Responsive"],tier:"professional"},{title:"Level 11 Events",desc:"Dynamic entertainment company site with video hero and event gallery.",img:"https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600",tags:["Events","Video","Animations"],tier:"premium"},{title:"Summit Construction",desc:"Rugged construction firm site with project portfolio and contact form.",img:"https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600",tags:["Construction","Portfolio","Contact"],tier:"professional"},{title:"Fresh Eats Cafe",desc:"Warm restaurant website with menu, hours, and ordering integration.",img:"https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600",tags:["Restaurant","Menu","Online Order"],tier:"starter"},{title:"MedFirst Clinic",desc:"Clean medical practice site with patient portal and appointment booking.",img:"https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600",tags:["Medical","HIPAA","Booking"],tier:"premium"}];const grid=document.getElementById("projects");function render(tier){grid.innerHTML="";projects.filter(p=>tier==="all"||p.tier===tier).forEach(p=>{grid.innerHTML+='<article class="project-card" data-tier="'+p.tier+'"><img class="project-img" src="'+p.img+'" alt="'+p.title+'" loading="lazy"/><div class="project-body"><h3>'+p.title+'</h3><p>'+p.desc+'</p><div class="tags">'+p.tags.map(t=>'<span class="tag">'+t+"</span>").join("")+'</div><button class="view-btn">View Project →</button></div></article>'})}function filterProjects(tier,btn){document.querySelectorAll(".filter-btn").forEach(b=>b.classList.remove("active"));btn.classList.add("active");render(tier)}render("all")</script></body></html>`,
    }],
  },
  {
    id: "tpl-how-it-works",
    name: "How It Works",
    description: "Step-by-step timeline, vertical mobile, horizontal desktop",
    icon: "🔄",
    files: [{
      path: "how-it-works.html",
      content: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>How It Works - {{BUSINESS_NAME}}</title><style>:root{--primary:#14b8a6;--secondary:#8b5cf6;--bg:#060b18;--card:#111827;--text:#f0f2f5}*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}.hiw-header{text-align:center;padding:4rem 2rem 2rem}.hiw-header h1{font-size:2.5rem;font-weight:800;margin-bottom:.5rem}.hiw-header p{color:#94a3b8;font-size:1.1rem}.timeline{max-width:1000px;margin:3rem auto;padding:0 2rem;display:flex;gap:0;position:relative}@media(max-width:768px){.timeline{flex-direction:column;gap:2rem;max-width:500px}}.timeline::before{content:"";position:absolute;top:50%;left:2rem;right:2rem;height:3px;background:linear-gradient(90deg,var(--primary),var(--secondary));z-index:0}@media(max-width:768px){.timeline::before{top:0;bottom:0;left:50%;width:3px;height:auto;right:auto}}.step{flex:1;text-align:center;position:relative;z-index:1;padding:0 1rem}@media(max-width:768px){.step{text-align:left;display:flex;gap:1.5rem;align-items:flex-start;padding:0}}.step-number{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--secondary));color:#fff;font-size:1.25rem;font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;border:4px solid var(--bg);box-shadow:0 0 0 2px var(--primary);flex-shrink:0}@media(max-width:768px){.step-number{margin:0}}.step-icon{font-size:2rem;margin-bottom:.75rem}@media(max-width:768px){.step-icon{display:none}}.step-content h3{font-size:1.1rem;font-weight:700;margin-bottom:.5rem}.step-content p{color:#94a3b8;font-size:.9rem;line-height:1.6}.cta-section{text-align:center;padding:4rem 2rem;max-width:600px;margin:0 auto}.cta-section h2{font-size:1.75rem;font-weight:800;margin-bottom:1rem}.cta-section p{color:#94a3b8;margin-bottom:2rem;font-size:1rem}.cta-btn{display:inline-block;padding:1rem 2.5rem;background:linear-gradient(135deg,var(--primary),var(--secondary));color:#fff;text-decoration:none;border-radius:.5rem;font-weight:700;font-size:1.1rem;transition:transform .2s,box-shadow .2s}.cta-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(20,184,166,.3)}footer{text-align:center;padding:3rem 2rem;color:#64748b;font-size:.85rem;border-top:1px solid #1e293b}</style></head><body><header class="hiw-header"><h1>How It Works</h1><p>From first contact to launch — here's our simple process</p></header><main><div class="timeline"><div class="step"><div class="step-icon">📋</div><div class="step-number">1</div><div class="step-content"><h3>Submit Your Intake</h3><p>Fill out our simple intake form with your business details, design preferences, and content.</p></div></div><div class="step"><div class="step-icon">🎨</div><div class="step-number">2</div><div class="step-content"><h3>We Design & Build</h3><p>Our AI-powered system creates your site, then a human designer reviews and polishes every detail.</p></div></div><div class="step"><div class="step-icon">✅</div><div class="step-number">3</div><div class="step-content"><h3>Review & Certify</h3><p>Your site is tested against Google Lighthouse standards and certified for performance, SEO, and accessibility.</p></div></div><div class="step"><div class="step-icon">🚀</div><div class="step-number">4</div><div class="step-content"><h3>Launch & Deploy</h3><p>We deploy to triple-redundant hosting and hand you the keys. Your site is live and ready for customers.</p></div></div></div><section class="cta-section"><h2>Ready to Get Started?</h2><p>Join hundreds of businesses who've launched beautiful, certified websites with {{BUSINESS_NAME}}.</p><a href="#" class="cta-btn">Start Your Project →</a></section></main><footer>&copy; 2026 {{BUSINESS_NAME}} &middot; {{phone}} &middot; {{email}}</footer></body></html>`,
    }],
  },
];

// ============================================================================
// GAME TEMPLATES
// ============================================================================

export const GAME_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'tpl_game_platformer',
    name: 'Platformer Game',
    description: 'Side-scrolling action with sprites, levels, and physics',
    icon: '🎮',
    files: [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Platformer Game</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #1a1a2e;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      font-family: 'Segoe UI', system-ui, sans-serif;
    }
    #game-container { text-align: center; }
    canvas {
      background: linear-gradient(180deg, #16213e 0%, #1a1a2e 100%);
      border: 3px solid #0f3460;
      border-radius: 8px;
    }
    h1 { color: #e94560; margin-bottom: 20px; font-size: 2rem; }
    .info { color: #94a3b8; margin-top: 16px; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div id="game-container">
    <h1>🎮 Platformer Game</h1>
    <canvas id="game" width="800" height="500"></canvas>
    <p class="info">Arrow keys / WASD to move • Space to jump</p>
  </div>

  <script>
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');

    // Game constants
    const GRAVITY = 0.5;
    const JUMP_FORCE = -12;
    const MOVE_SPEED = 5;
    const GROUND_Y = canvas.height - 60;

    // Player
    const player = {
      x: 100,
      y: GROUND_Y - 40,
      width: 40,
      height: 40,
      velX: 0,
      velY: 0,
      onGround: false,
      color: '#e94560'
    };

    // Platforms
    const platforms = [
      { x: 0, y: GROUND_Y, width: canvas.width, height: 60, color: '#0f3460' },
      { x: 200, y: 350, width: 150, height: 20, color: '#16213e' },
      { x: 450, y: 280, width: 150, height: 20, color: '#16213e' },
      { x: 650, y: 200, width: 120, height: 20, color: '#16213e' },
    ];

    // Coins
    const coins = [
      { x: 250, y: 310, radius: 12, collected: false },
      { x: 500, y: 240, radius: 12, collected: false },
      { x: 700, y: 160, radius: 12, collected: false },
    ];

    let score = 0;
    const keys = {};

    // Input
    window.addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Space') e.preventDefault(); });
    window.addEventListener('keyup', e => keys[e.code] = false);

    function update() {
      // Horizontal movement
      player.velX = 0;
      if (keys['ArrowLeft'] || keys['KeyA']) player.velX = -MOVE_SPEED;
      if (keys['ArrowRight'] || keys['KeyD']) player.velX = MOVE_SPEED;

      // Jumping
      if ((keys['Space'] || keys['ArrowUp'] || keys['KeyW']) && player.onGround) {
        player.velY = JUMP_FORCE;
        player.onGround = false;
      }

      // Apply gravity
      player.velY += GRAVITY;

      // Move player
      player.x += player.velX;
      player.y += player.velY;

      // Platform collision
      player.onGround = false;
      platforms.forEach(plat => {
        if (player.x < plat.x + plat.width &&
            player.x + player.width > plat.x &&
            player.y + player.height > plat.y &&
            player.y + player.height < plat.y + plat.height + player.velY) {
          player.y = plat.y - player.height;
          player.velY = 0;
          player.onGround = true;
        }
      });

      // Boundaries
      if (player.x < 0) player.x = 0;
      if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

      // Coin collection
      coins.forEach(coin => {
        if (!coin.collected) {
          const dx = player.x + player.width/2 - coin.x;
          const dy = player.y + player.height/2 - coin.y;
          if (Math.sqrt(dx*dx + dy*dy) < coin.radius + 20) {
            coin.collected = true;
            score += 100;
          }
        }
      });

      // Fall off screen
      if (player.y > canvas.height) {
        player.x = 100;
        player.y = GROUND_Y - player.height;
        player.velY = 0;
      }
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw platforms
      platforms.forEach(plat => {
        ctx.fillStyle = plat.color;
        ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
      });

      // Draw coins
      coins.forEach(coin => {
        if (!coin.collected) {
          ctx.fillStyle = '#ffd700';
          ctx.beginPath();
          ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffed4a';
          ctx.beginPath();
          ctx.arc(coin.x - 3, coin.y - 3, coin.radius * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw player
      ctx.fillStyle = player.color;
      ctx.fillRect(player.x, player.y, player.width, player.height);
      // Eyes
      ctx.fillStyle = 'white';
      ctx.fillRect(player.x + 8, player.y + 10, 8, 8);
      ctx.fillRect(player.x + 24, player.y + 10, 8, 8);
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(player.x + 10, player.y + 12, 4, 4);
      ctx.fillRect(player.x + 26, player.y + 12, 4, 4);

      // Draw score
      ctx.fillStyle = '#e94560';
      ctx.font = 'bold 24px system-ui';
      ctx.fillText('Score: ' + score, 20, 40);
    }

    function gameLoop() {
      update();
      draw();
      requestAnimationFrame(gameLoop);
    }

    gameLoop();
  </script>
</body>
</html>`,
      },
    ],
  },
  {
    id: 'tpl_game_puzzle',
    name: 'Puzzle Game',
    description: 'Logic puzzles with grid-based gameplay',
    icon: '🧩',
    files: [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Puzzle Game</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: 'Segoe UI', system-ui, sans-serif;
    }
    .game-container {
      background: white;
      padding: 2rem;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
      text-align: center;
    }
    h1 { color: #1e293b; margin-bottom: 0.5rem; }
    .info { color: #64748b; margin-bottom: 1rem; }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 80px);
      gap: 8px;
      margin: 1rem auto;
    }
    .tile {
      width: 80px;
      height: 80px;
      background: #6366f1;
      color: white;
      font-size: 24px;
      font-weight: bold;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .tile:hover { transform: scale(1.05); background: #4f46e5; }
    .tile.empty { background: #e2e8f0; cursor: default; }
    .tile.empty:hover { transform: none; }
    .controls { margin-top: 1rem; }
    .btn {
      padding: 0.75rem 1.5rem;
      background: #6366f1;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      cursor: pointer;
    }
    .btn:hover { background: #4f46e5; }
    .moves { margin-top: 1rem; font-size: 1.25rem; color: #64748b; }
  </style>
</head>
<body>
  <div class="game-container">
    <h1>🧩 Slide Puzzle</h1>
    <p class="info">Click tiles next to the empty space to move them</p>
    <div class="grid" id="grid"></div>
    <p class="moves">Moves: <span id="moves">0</span></p>
    <div class="controls">
      <button class="btn" onclick="shuffle()">New Game</button>
    </div>
  </div>

  <script>
    const gridEl = document.getElementById('grid');
    const movesEl = document.getElementById('moves');
    let tiles = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,0];
    let moves = 0;

    function render() {
      gridEl.innerHTML = '';
      tiles.forEach((num, i) => {
        const btn = document.createElement('button');
        btn.className = 'tile' + (num === 0 ? ' empty' : '');
        btn.textContent = num || '';
        btn.onclick = () => move(i);
        gridEl.appendChild(btn);
      });
      movesEl.textContent = moves;
    }

    function move(index) {
      const emptyIndex = tiles.indexOf(0);
      const validMoves = [emptyIndex - 1, emptyIndex + 1, emptyIndex - 4, emptyIndex + 4];

      // Check row boundaries
      if (emptyIndex % 4 === 0 && index === emptyIndex - 1) return;
      if (emptyIndex % 4 === 3 && index === emptyIndex + 1) return;

      if (validMoves.includes(index)) {
        [tiles[index], tiles[emptyIndex]] = [tiles[emptyIndex], tiles[index]];
        moves++;
        render();
        checkWin();
      }
    }

    function shuffle() {
      moves = 0;
      for (let i = 0; i < 100; i++) {
        const emptyIndex = tiles.indexOf(0);
        const validMoves = [];
        if (emptyIndex % 4 !== 0) validMoves.push(emptyIndex - 1);
        if (emptyIndex % 4 !== 3) validMoves.push(emptyIndex + 1);
        if (emptyIndex >= 4) validMoves.push(emptyIndex - 4);
        if (emptyIndex < 12) validMoves.push(emptyIndex + 4);
        const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
        [tiles[randomMove], tiles[emptyIndex]] = [tiles[emptyIndex], tiles[randomMove]];
      }
      render();
    }

    function checkWin() {
      const win = tiles.every((num, i) => num === (i + 1) % 16);
      if (win) {
        setTimeout(() => alert('🎉 You won in ' + moves + ' moves!'), 100);
      }
    }

    shuffle();
  </script>
</body>
</html>`,
      },
    ],
  },
  {
    id: 'tpl_game_custom',
    name: 'Custom Game',
    description: 'Blank canvas for any browser game',
    icon: '🕹️',
    files: [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Game</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #1a1a2e;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      font-family: 'Segoe UI', system-ui, sans-serif;
    }
    #game-container { text-align: center; }
    canvas {
      background: #16213e;
      border: 2px solid #0f3460;
      border-radius: 8px;
    }
    h1 { color: #e94560; margin-bottom: 20px; font-size: 2rem; }
    .info { color: #94a3b8; margin-top: 16px; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div id="game-container">
    <h1>🕹️ My Game</h1>
    <canvas id="game" width="800" height="600"></canvas>
    <p class="info">Use arrow keys or WASD to move</p>
  </div>

  <script>
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');

    // Game state
    const player = {
      x: canvas.width / 2,
      y: canvas.height / 2,
      size: 40,
      speed: 5,
      color: '#e94560'
    };

    const keys = {};

    // Input handling
    window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

    function update() {
      if (keys['w'] || keys['arrowup']) player.y -= player.speed;
      if (keys['s'] || keys['arrowdown']) player.y += player.speed;
      if (keys['a'] || keys['arrowleft']) player.x -= player.speed;
      if (keys['d'] || keys['arrowright']) player.x += player.speed;

      // Keep in bounds
      player.x = Math.max(player.size/2, Math.min(canvas.width - player.size/2, player.x));
      player.y = Math.max(player.size/2, Math.min(canvas.height - player.size/2, player.y));
    }

    function draw() {
      ctx.fillStyle = '#16213e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw player
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.size/2, 0, Math.PI * 2);
      ctx.fill();
    }

    function gameLoop() {
      update();
      draw();
      requestAnimationFrame(gameLoop);
    }

    gameLoop();
  </script>
</body>
</html>`,
      },
    ],
  },
];

// Combine all templates
export const ALL_TEMPLATES = [...PROJECT_TEMPLATES, ...CLIENT_PAGE_TEMPLATES, ...GAME_TEMPLATES];

/**
 * Get a template by ID (searches both project and game templates)
 */
export function getTemplateById(id: string): ProjectTemplate | undefined {
  return ALL_TEMPLATES.find(t => t.id === id);
}
