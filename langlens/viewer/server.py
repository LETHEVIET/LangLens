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
            self.path = '/200.html'
        
        return super().do_GET()

def start_viewer(file_path: str, port: int = 5000):
    data_path = os.path.abspath(file_path)
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Trace file not found at {data_path}")

    # Path to the bundled static assets
    current_dir = os.path.dirname(os.path.abspath(__file__))
    static_dir = os.path.join(current_dir, 'static')

    if not os.path.exists(static_dir):
        raise FileNotFoundError(f"Static assets directory not found at {static_dir}. Did you bundle the web UI?")

    TraceHandler.data_path = data_path
    TraceHandler.static_dir = static_dir
    
    # We change directory to static_dir so SimpleHTTPRequestHandler serves files correctly
    # but we do it inside the context of the server to avoid side effects if possible
    # Actually, SimpleHTTPRequestHandler uses os.getcwd() by default in some versions,
    # but we can pass directory to the constructor in Python 3.7+
    
    # Change to static_dir so SimpleHTTPRequestHandler serves files correctly
    original_cwd = os.getcwd()
    os.chdir(static_dir)
    
    url = f"http://localhost:{port}"
    print(f"\n--- LangLens Visualizer ---")
    print(f"Viewing: {data_path}")
    print(f"Serving at: {url}")
    print(f"Press Ctrl+C to stop.\n")

    http.server.HTTPServer.allow_reuse_address = True
    try:
        with http.server.HTTPServer(("", port), TraceHandler) as httpd:
            Timer(1, lambda: webbrowser.open(url)).start()
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        os.chdir(original_cwd)
