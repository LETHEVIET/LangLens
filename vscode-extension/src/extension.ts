import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(LangLensEditorProvider.register(context));
}

export class LangLensEditorProvider implements vscode.CustomTextEditorProvider {

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new LangLensEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(LangLensEditorProvider.viewType, provider);
        return providerRegistration;
    }

    private static readonly viewType = 'langlens-viewer.editor';

    constructor(
        private readonly context: vscode.ExtensionContext
    ) { }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
            ]
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        function updateWebview() {
            webviewPanel.webview.postMessage({
                type: 'update',
                text: document.getText(),
            });
        }

        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                updateWebview();
            }
        });

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        webviewPanel.webview.onDidReceiveMessage(e => {
            switch (e.type) {
                case 'ready':
                    updateWebview();
                    return;
            }
        });
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const mediaPath = path.join(this.context.extensionPath, 'media');
        const indexPath = path.join(mediaPath, '200.html');

        if (!fs.existsSync(indexPath)) {
            return `<html><body><h1>Error: ${indexPath} not found</h1><p>Expected path: ${indexPath}</p></body></html>`;
        }

        let html = fs.readFileSync(indexPath, 'utf8');

        // Get the webview URI for the media directory
        const mediaUri = webview.asWebviewUri(vscode.Uri.file(mediaPath));
        const baseHref = mediaUri.toString().endsWith('/') ? mediaUri.toString() : `${mediaUri}/`;
        
        // Inject CSP and base tag
        const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource};">`;
        
        html = html.replace('<head>', `<head>\n\t${csp}\n\t<base href="${baseHref}">`);

        // Replace all /_app/ paths (in imports, src, href) with ./_app/
        html = html.replace(/(["'])\/_app\//g, '$1./_app/');
        
        // Fix SvelteKit base path for hash router
        html = html.replace(/base:\s*new URL\([^)]+\)\.pathname\.slice\([^)]+\)/g, 'base: ""');
        
        // Inject CSS links for the app (SvelteKit doesn't include them in fallback)
        const cssLinks = `\n\t<link rel="stylesheet" href="./_app/immutable/assets/0.DtSUOiyh.css">\n\t<link rel="stylesheet" href="./_app/immutable/assets/2.BJeb8yqE.css">`;
        html = html.replace('</head>', `${cssLinks}\n\t</head>`);

        return html;
    }
}

export function deactivate() {}
