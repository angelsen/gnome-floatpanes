#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFilter, ImageOps

def add_corners_and_shadow(input_path, output_path, corner_radius=15, shadow_size=8):
    # Open the image
    original = Image.open(input_path).convert("RGBA")
    width, height = original.size
    
    # Create a mask for rounded corners
    mask = Image.new('L', (width, height), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), (width, height)], corner_radius, fill=255)
    
    # Apply the mask to get rounded corners
    rounded_img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    rounded_img.paste(original, (0, 0), mask)
    
    # Create shadow
    shadow = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle([(shadow_size, shadow_size), 
                                  (width, height)], 
                                  corner_radius, fill=(0, 0, 0, 100))
    shadow = shadow.filter(ImageFilter.GaussianBlur(shadow_size))
    
    # Combine shadow and image with padding
    padded_size = (width + shadow_size*2, height + shadow_size*2)
    result = Image.new('RGBA', padded_size, (0, 0, 0, 0))
    
    # Paste shadow first
    result.paste(shadow, (0, 0), shadow)
    
    # Then paste the original image with rounded corners
    result.paste(rounded_img, (0, 0), rounded_img)
    
    result.save(output_path)
    print(f"Styled image saved to {output_path}")

if __name__ == "__main__":
    add_corners_and_shadow(
        input_path="resources/screenshot.png",
        output_path="resources/screenshot_styled.png"
    )