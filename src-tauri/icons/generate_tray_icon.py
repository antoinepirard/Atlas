#!/usr/bin/env python3
"""Generate a high-quality tray icon for Atlas - A in a rounded square."""

from PIL import Image, ImageDraw, ImageFont
import os

def create_tray_icon(size, output_path):
    """Create a high-resolution tray icon with 'A' in a rounded square.
    
    We render at high resolution for crisp display on retina screens.
    macOS will scale it appropriately for the menu bar.
    """
    # Create the base image (transparent)
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    
    # Create a mask for the rounded rectangle with the A cutout
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    
    # Small padding from edge
    padding = int(size * 0.02)
    
    # Draw rounded rectangle on mask (white = opaque)
    # Use a nice corner radius - about 22% of size for app-icon style
    corner_radius = int(size * 0.22)
    rect_bounds = [padding, padding, size - padding - 1, size - padding - 1]
    mask_draw.rounded_rectangle(rect_bounds, radius=corner_radius, fill=255)
    
    # Calculate font size - make the A fill most of the space
    font_size = int(size * 0.75)
    
    # Try to use Newsreader font (the app's branding font)
    font = None
    newsreader_paths = [
        # Newsreader variants
        "/System/Library/Fonts/Supplemental/Newsreader-SemiBoldItalic.ttf",
        "/Library/Fonts/Newsreader-SemiBoldItalic.ttf",
        os.path.expanduser("~/Library/Fonts/Newsreader-SemiBoldItalic.ttf"),
        os.path.expanduser("~/Library/Fonts/Newsreader_18pt-SemiBoldItalic.ttf"),
        # Good serif italic fallbacks
        "/System/Library/Fonts/Supplemental/Georgia Italic.ttf",
        "/System/Library/Fonts/Supplemental/Times New Roman Italic.ttf",
        "/System/Library/Fonts/Times.ttc",
    ]
    
    for font_path in newsreader_paths:
        if os.path.exists(font_path):
            try:
                font = ImageFont.truetype(font_path, font_size)
                print(f"Using font: {font_path}")
                break
            except Exception as e:
                continue
    
    if font is None:
        print("Warning: Using default font")
        font = ImageFont.load_default()
    
    # Get text bounding box for centering
    text = "A"
    bbox = mask_draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    # Center the text (with slight vertical adjustment for optical centering)
    x = (size - text_width) // 2 - bbox[0]
    y = (size - text_height) // 2 - bbox[1] - int(size * 0.02)
    
    # Draw the "A" on the mask as black (this creates the transparent cutout)
    mask_draw.text((x, y), text, fill=0, font=font)
    
    # Create the final image: black where mask is white, transparent elsewhere
    img.paste((0, 0, 0, 255), (0, 0, size, size))
    img.putalpha(mask)
    
    # Save with maximum quality
    img.save(output_path, 'PNG', optimize=False)
    print(f"Created: {output_path} ({size}x{size})")

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Create high-resolution icons
    # macOS menu bar is ~22pt, but we render much larger for sharpness
    # The @2x version is for retina displays
    
    # Standard resolution (will be used and scaled)
    create_tray_icon(128, os.path.join(script_dir, "trayIcon.png"))
    
    # Retina resolution  
    create_tray_icon(256, os.path.join(script_dir, "trayIcon@2x.png"))
    
    print("\nDone! High-resolution tray icons created.")
