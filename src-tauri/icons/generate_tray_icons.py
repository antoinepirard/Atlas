#!/usr/bin/env python3
"""Generate monochrome tray icons for macOS menu bar."""

from PIL import Image, ImageDraw, ImageFont
import os

def create_tray_icon(size, output_path):
    """Create a monochrome 'A' icon for macOS menu bar."""
    # Create transparent image
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Calculate font size (about 70% of icon size for good visibility)
    font_size = int(size * 0.75)
    
    # Try to use a nice font, fallback to default
    try:
        # macOS system font
        font = ImageFont.truetype("/System/Library/Fonts/SFCompact.ttf", font_size)
    except:
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        except:
            font = ImageFont.load_default()
    
    # Draw the "A" in black (will be templated by macOS)
    text = "A"
    
    # Get text bounding box for centering
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    # Center the text
    x = (size - text_width) // 2 - bbox[0]
    y = (size - text_height) // 2 - bbox[1]
    
    # Draw black text (template icons should be black, macOS handles coloring)
    draw.text((x, y), text, fill=(0, 0, 0, 255), font=font)
    
    # Save
    img.save(output_path, 'PNG')
    print(f"Created: {output_path}")

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Create 22x22 (1x) icon
    create_tray_icon(22, os.path.join(script_dir, "trayIcon.png"))
    
    # Create 44x44 (2x Retina) icon
    create_tray_icon(44, os.path.join(script_dir, "trayIcon@2x.png"))
    
    print("Done! Tray icons created.")

