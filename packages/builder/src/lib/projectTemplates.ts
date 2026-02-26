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
export const ALL_TEMPLATES = [...PROJECT_TEMPLATES, ...GAME_TEMPLATES];

/**
 * Get a template by ID (searches both project and game templates)
 */
export function getTemplateById(id: string): ProjectTemplate | undefined {
  return ALL_TEMPLATES.find(t => t.id === id);
}
