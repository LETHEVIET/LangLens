
const fs = require('fs');
const path = require('path');

// Configuration
const canvas_size = 512; // Reduced from 800 to be tighter
const cx = canvas_size / 2;
const cy = canvas_size / 2;
const card_w = 420;  // Reduced to fit tighter around content
const card_h = 280;  // Reduced to fit tighter
const card_r = 24;   // Scaled down slightly

const colors = {
    bg: "#ffffff",
    textPrimary: "#0f172a",
    textAccent: "#10b981", 
    brandPrimary: "#6366f1", 
    cardBorder: "#f1f5f9",
    shadow: "rgba(99, 102, 241, 0.15)"
};

// Values from snippet
// <g transform={`translate(${cx - 185}, ${cy - 110})`}>
// We need to recenter the graph. Visual center of graph is roughly x=50.
// So to place it at cx, we need translate(cx - 50, ...)
// Previous Y was cy - 110. Content height is ~80. Text starts at cy+15.
// Let's shift everything up slightly to center in the new card_h.
// Total content height approx: 80 (graph) + 20 (gap) + 85 (text) = 185.
// Card H = 280. Padding = (280 - 185) / 2 = 47.5.
// Top of content should be at cy - card_h/2 + 47.5.
// Graph starts at 0 relative to group? No, typical nodes 12..76.
// Let's tweak positions manually for visual balance.

function generate_logo_svg() {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${canvas_size}" height="${canvas_size}" viewBox="0 0 ${canvas_size} ${canvas_size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color: ${colors.bg}; stop-opacity: 1" />
          <stop offset="100%" style="stop-color: #f8fafc; stop-opacity: 1" />
        </linearGradient>

        <filter id="mainShadow" x="-20%" y="-20%" width="140%" height="160%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="15" />
          <feOffset dx="0" dy="20" result="offsetblur" />
          <feFlood flood-color="${colors.brandPrimary}" flood-opacity="0.15" /> 
          <feComposite in2="offsetblur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <pattern id="gridPattern" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.5" fill="#cbd5e1" opacity="0.3" />
        </pattern>
        
        <style>
          /* <![CDATA[ */
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=JetBrains+Mono:wght@700&display=swap');
          /* ]]> */
        </style>
      </defs>

      <!-- Main Card -->
      <rect 
        x="${cx - card_w / 2}" y="${cy - card_h / 2}" 
        width="${card_w}" height="${card_h}" 
        rx="${card_r}" 
        fill="url(#cardGrad)" 
        filter="url(#mainShadow)"
        stroke="${colors.cardBorder}"
        stroke-width="1"
      />

      <!-- Subtle Dot Pattern -->
      <rect 
        x="${cx - card_w / 2}" y="${cy - card_h / 2}" 
        width="${card_w}" height="${card_h}" 
        rx="${card_r}" 
        fill="url(#gridPattern)" 
      />

      <!-- Graph Visual Element - Centered -->
      <g transform="translate(${cx - 50}, ${cy - 90})">
        <!-- Connection Lines -->
        <line x1="12" y1="12" x2="50" y2="40" stroke="${colors.brandPrimary}" stroke-width="5" stroke-linecap="round" />
        <line x1="50" y1="40" x2="22" y2="72" stroke="${colors.brandPrimary}" stroke-width="5" stroke-linecap="round" opacity="0.4" />
        
        <!-- Nodes -->
        <circle cx="12" cy="12" r="7" fill="${colors.brandPrimary}" />
        <circle cx="50" cy="40" r="10" fill="${colors.textAccent}" />
        <circle cx="22" cy="72" r="7" fill="${colors.brandPrimary}" />

        <!-- The "Lens" Overlay -->
        <circle cx="50" cy="40" r="26" fill="none" stroke="${colors.textAccent}" stroke-width="6" />
        <path d="M70" 60 L86 76" stroke="${colors.textAccent}" stroke-width="8" stroke-linecap="round" />
      </g>

      <!-- Typography Section - Centered below graph -->
      <g transform="translate(${cx}, ${cy + 30})" text-anchor="middle" style="font-family: 'Plus Jakarta Sans', sans-serif">
        <text 
          y="0" 
          font-size="64" 
          font-weight="800" 
          letter-spacing="-3" 
          fill="${colors.textPrimary}"
        >
          Lang<tspan fill="${colors.textAccent}">Lens</tspan>
        </text>
        
        <text 
          y="40" 
          font-size="11" 
          font-weight="700" 
          letter-spacing="3" 
          fill="${colors.brandPrimary}" 
          opacity="0.8"
          class="uppercase"
          style="font-family: 'JetBrains Mono', monospace; text-transform: uppercase;"
        >
          Node-Level Observability
        </text>
      </g>
    </svg>`;
    return svg;
}

function generate_favicon_svg() {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
         <defs>
            <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
            <stop offset="100%" stop-color="#f8fafc" stop-opacity="1" />
            </linearGradient>
        </defs>
        
        <g transform="translate(2.5, 7.5)">
            <!-- Connection Lines -->
            <line x1="12" y1="12" x2="50" y2="40" stroke="${colors.brandPrimary}" stroke-width="5" stroke-linecap="round" />
            <line x1="50" y1="40" x2="22" y2="72" stroke="${colors.brandPrimary}" stroke-width="5" stroke-linecap="round" opacity="0.4" />
            
            <!-- Nodes -->
            <circle cx="12" cy="12" r="7" fill="${colors.brandPrimary}" />
            <circle cx="50" cy="40" r="10" fill="${colors.textAccent}" />
            <circle cx="22" cy="72" r="7" fill="${colors.brandPrimary}" />

            <!-- The "Lens" Overlay -->
            <circle cx="50" cy="40" r="26" style="fill:none; stroke:${colors.textAccent}; stroke-width:6;" />
            <path d="M70,60 L86,76" style="fill:none; stroke:${colors.textAccent}; stroke-width:8; stroke-linecap:round;" />
        </g>
    </svg>`;
    return svg;
}

const opentype = require('opentype.js');

if (require.main === module) {
    const output_dir = "/mnt/data/code/langlens/web-ui/static";
    const font_dir = "/mnt/data/code/langlens/web-ui/static/fonts";
    
    if (!fs.existsSync(output_dir)){
        fs.mkdirSync(output_dir, { recursive: true });
    }

    // Load fonts
    const fontPJSBold = opentype.loadSync(`${font_dir}/PlusJakartaSans-Bold.ttf`);
    const fontPJSExtraBold = opentype.loadSync(`${font_dir}/PlusJakartaSans-ExtraBold.ttf`);
    const fontJBMonoBold = opentype.loadSync(`${font_dir}/JetBrainsMono-Bold.ttf`);

    function generate_logo_svg_paths() {
        // Text Parameters
        const titleSize = 64;
        const subTitleSize = 11;
        
        // Calculate paths
        // "Lang" - ExtraBold (800)
        const pathLang = fontPJSExtraBold.getPath('Lang', 0, 0, titleSize);
        const widthLang = fontPJSExtraBold.getAdvanceWidth('Lang', titleSize);
        
        const pathLens = fontPJSExtraBold.getPath('Lens', widthLang, 0, titleSize);
        const widthLens = fontPJSExtraBold.getAdvanceWidth('Lens', titleSize);
        
        const totalTitleWidth = widthLang + widthLens;
        
        // JetBrains Mono for Subtitle
        const subtitleText = "NODE-LEVEL OBSERVABILITY";
        const pathSubtitle = fontJBMonoBold.getPath(subtitleText, 0, 0, subTitleSize);
        const widthSubtitle = fontJBMonoBold.getAdvanceWidth(subtitleText, subTitleSize);
        
        // --- Centering Logic ---
        const titleStartX = -totalTitleWidth / 2;
        
        // Apply Color and Translation
        // Note: We inject colors via fill attribute on the path element later
        
        const stringLang = pathLang.toPathData(2);
        const stringLens = pathLens.toPathData(2);
        
        const subtitleStartX = -widthSubtitle / 2;
        const pSubFinal = fontJBMonoBold.getPath(subtitleText, subtitleStartX, 40, subTitleSize);

        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${canvas_size}" height="${canvas_size}" viewBox="0 0 ${canvas_size} ${canvas_size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${colors.bg}" stop-opacity="1" />
          <stop offset="100%" stop-color="#f8fafc" stop-opacity="1" />
        </linearGradient>

        <filter id="mainShadow" x="-20%" y="-20%" width="140%" height="160%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="15" />
          <feOffset dx="0" dy="20" result="offsetblur" />
          <feFlood flood-color="${colors.brandPrimary}" flood-opacity="0.15" result="colorblur" /> 
          <feComposite in="colorblur" in2="offsetblur" operator="in" result="shadow" />
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <pattern id="gridPattern" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.5" fill="#cbd5e1" opacity="0.3" />
        </pattern>
      </defs>

      <!-- Main Card -->
      <rect 
        x="${cx - card_w / 2}" y="${cy - card_h / 2}" 
        width="${card_w}" height="${card_h}" 
        rx="${card_r}" 
        fill="url(#cardGrad)" 
        filter="url(#mainShadow)"
        stroke="${colors.cardBorder}"
        stroke-width="1"
      />

      <!-- Subtle Dot Pattern -->
      <rect 
        x="${cx - card_w / 2}" y="${cy - card_h / 2}" 
        width="${card_w}" height="${card_h}" 
        rx="${card_r}" 
        fill="url(#gridPattern)" 
      />

      <!-- Graph Visual Element - Centered -->
      <g transform="translate(${cx - 50}, ${cy - 90})">
        <!-- Connection Lines -->
        <line x1="12" y1="12" x2="50" y2="40" stroke="${colors.brandPrimary}" stroke-width="5" stroke-linecap="round" />
        <line x1="50" y1="40" x2="22" y2="72" stroke="${colors.brandPrimary}" stroke-width="5" stroke-linecap="round" opacity="0.4" />
        
        <!-- Nodes -->
        <circle cx="12" cy="12" r="7" fill="${colors.brandPrimary}" />
        <circle cx="50" cy="40" r="10" fill="${colors.textAccent}" />
        <circle cx="22" cy="72" r="7" fill="${colors.brandPrimary}" />

        <!-- The "Lens" Overlay -->
        <!-- Using style attribute for maximum compatibility -->
        <circle cx="50" cy="40" r="26" style="fill:none; stroke:${colors.textAccent}; stroke-width:6;" />
        <path d="M70,60 L86,76" style="fill:none; stroke:${colors.textAccent}; stroke-width:8; stroke-linecap:round;" />
      </g>

      <!-- Typography Section - Centered below graph -->
      <g transform="translate(${cx}, ${cy + 30})">
        <!-- LangLens Title -->
        <!-- Manual offset for Title parts -->
        <g transform="translate(${titleStartX}, 0)">
           <path d="${stringLang}" fill="${colors.textPrimary}" />
           <path d="${stringLens}" fill="${colors.textAccent}" />
        </g>
        
        <!-- Subtitle -->
        <path d="${pSubFinal.toPathData(2)}" fill="${colors.brandPrimary}" opacity="0.8" />
      </g>
    </svg>`;
        return svg;
    }
    
    fs.writeFileSync(`${output_dir}/logo.svg`, generate_logo_svg_paths());
    fs.writeFileSync(`${output_dir}/favicon.svg`, generate_favicon_svg()); 
        
    console.log("Files created with vector paths.");
}
