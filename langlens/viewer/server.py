import os
import http.server
import webbrowser
import socketserver
from threading import Timer

class TraceHandler(http.server.SimpleHTTPRequestHandler):
    data_path = ""
    static_dir = ""

    def do_GET(self):
        # Serve the .langlens file data at /data
        if self.path == '/data':
            try:
                with open(self.data_path, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content)
            except Exception as e:
                self.send_error(500, str(e))
            return

        # SvelteKit routing fallback for SPA
        # If the file doesn't exist in the static directory, serve 200.html
        request_path = self.translate_path(self.path)
        if not os.path.exists(request_path) or os.path.isdir(request_path):
            # We need to serve 200.html with injected CSS
            fallback_path = self.translate_path('/200.html')
            
            if os.path.exists(fallback_path):
                content = self._read_and_inject_css(fallback_path)
                self.send_response(200)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                self.wfile.write(content)
                return
            
            self.path = '/200.html'
        
        return super().do_GET()

    def _read_and_inject_css(self, html_path: str) -> bytes:
        """Read HTML and inject links to all CSS files found in _app/immutable/assets."""
        try:
            with open(html_path, 'r', encoding='utf-8') as f:
                html = f.read()
            
            # Find CSS files
            assets_dir = os.path.join(self.static_dir, '_app', 'immutable', 'assets')
            css_links = ""
            if os.path.exists(assets_dir):
                for filename in os.listdir(assets_dir):
                    if filename.endswith('.css'):
                        # Use relative path suitable for href
                        href = f"/_app/immutable/assets/{filename}"
                        css_links += f'<link rel="stylesheet" href="{href}">\n'
            
            if css_links:
                html = html.replace('</head>', f'{css_links}</head>')
            
            return html.encode('utf-8')
        except Exception as e:
            print(f"Error injecting CSS: {e}")
            # Fallback to serving the file as is (via standard handler if we returned None, but here we just read it)
            with open(html_path, 'rb') as f:
                return f.read()

def start_viewer(file_path: str, port: int = 5000, dev_mode: bool = False):
    data_path = os.path.abspath(file_path)
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Trace file not found at {data_path}")

    # Path to the bundled static assets
    current_dir = os.path.dirname(os.path.abspath(__file__))
    static_dir = os.path.join(current_dir, 'static')

    if not dev_mode and not os.path.exists(static_dir):
        raise FileNotFoundError(f"Static assets directory not found at {static_dir}. Did you bundle the web UI?")

    TraceHandler.data_path = data_path
    TraceHandler.static_dir = static_dir
    
    # Change to static_dir so SimpleHTTPRequestHandler serves files correctly
    # Only strictly necessary if serving static files, but harmless in dev mode (Where we only serve /data)
    original_cwd = os.getcwd()
    if os.path.exists(static_dir):
        os.chdir(static_dir)
    
    api_url = f"http://localhost:{port}"
    frontend_url = api_url
    
    vite_process = None

    if dev_mode:
        import subprocess
        import atexit
        
        # Attempt to find web-ui directory
        # Assuming installed in editable mode or running from source
        repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        web_ui_dir = os.path.join(repo_root, 'web-ui')
        
        if os.path.exists(web_ui_dir):
            print(f"Starting Vite dev server in {web_ui_dir}...")
            try:
                # Run pnpm dev
                vite_process = subprocess.Popen(
                    ['pnpm', 'dev'], 
                    cwd=web_ui_dir,
                    # We can let it print to stdout/stderr so the user sees build errors
                )
                atexit.register(lambda: vite_process.terminate())
                frontend_url = "http://localhost:5173"
            except Exception as e:
                print(f"Failed to start Vite server: {e}")
        else:
            print(f"Warning: web-ui directory not found at {web_ui_dir}. Cannot start dev server.")

    print(f"\n--- LangLens Visualizer ---")
    print(f"Viewing: {data_path}")
    print(f"API Server: {api_url}")
    if vite_process:
        print(f"Dev Server: {frontend_url}")
    print(f"Press Ctrl+C to stop.\n")

    http.server.HTTPServer.allow_reuse_address = True
    try:
        with http.server.HTTPServer(("", port), TraceHandler) as httpd:
            # Open the appropriate URL
            Timer(1, lambda: webbrowser.open(frontend_url)).start()
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        if vite_process:
            vite_process.terminate()
    finally:
        os.chdir(original_cwd)
