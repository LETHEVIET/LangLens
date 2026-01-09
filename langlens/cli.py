import argparse
import sys
from .viewer.server import start_viewer

def main():
    parser = argparse.ArgumentParser(description='LangLens CLI tool')
    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # Visualize command
    viz_parser = subparsers.add_parser('visualize', help='Visualize a .langlens file')
    viz_parser.add_argument('file', help='Path to the .langlens file')
    viz_parser.add_argument('--port', type=int, default=5000, help='Port to host the viewer (default: 5000)')

    args = parser.parse_args()

    if args.command == 'visualize':
        try:
            start_viewer(args.file, args.port)
        except Exception as e:
            print(f"Error: {e}")
            sys.exit(1)
    else:
        print(f"\n--- LangLens Visualizer ---")
        parser.print_help()

if __name__ == '__main__':
    main()
