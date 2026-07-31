# Shape Fall 🌈

An interactive physics sandbox where colorful geometric shapes fall with super-fast gravity. Grab, throw, and watch them bounce!

## Features

### 🎨 7 Unique Shapes
- **Circle** - Classic round shape
- **Square** - Perfect rectangle
- **Triangle** - Three-sided polygon
- **Star** - Five-pointed star
- **Pentagon** - Five-sided polygon
- **Hexagon** - Six-sided polygon
- **Diamond** - Elongated rhombus

### 🌈 8 Vibrant Colors
Each shape is randomly colored from a handpicked palette:
- Pink `#ff6b9d`
- Purple `#c44dff`
- Blue `#4d9aff`
- Cyan `#4dffdf`
- Green `#4dff88`
- Yellow `#ffd93d`
- Orange `#ff6e3d`
- Red `#ff4d4d`

### ⚡ Super-Fast Gravity
- **Gravity:** 1.2x multiplier (much faster than geometric-gravity)
- **Friction:** 0.98 for realistic slowdown
- **Bounce:** 0.65 coefficient for satisfying rebounds
- **Rotation:** Spins on impact

### 🎮 Smooth Interactions
- **Grab:** Click and hold any shape to grab it
- **Smooth Follow:** Shapes lerp to cursor position (0.3 speed) for fluid motion
- **Scale Effect:** Grabbed shapes scale to 1.2x
- **Throw:** Release to throw with momentum
- **Hover Indicator:** Dashed circle shows grab radius

### 🎛️ Controls
- **Reset Button (🔄):** Clear all shapes and spawn 15 new ones
- **Add Shapes Button (➕):** Add 5 more shapes to the scene
- **Back Button (← Back):** Return to main fidget toys menu

## Physics

### Gravity System
```javascript
GRAVITY = 1.2 // Super fast falling
```

### Collision Detection
- **Walls:** Shapes bounce off left/right edges
- **Floor:** Shapes bounce and gradually settle
- **Ceiling:** Shapes bounce off the top

### Rotation
- Shapes rotate while falling
- Rotation reverses on wall/floor impact
- Rotation slows when shapes settle

## Visual Effects

### Glow Shadows
- **Idle:** 15px blur
- **Grabbed:** 30px blur (2x intensity)
- Color-matched to shape

### Animations
- **Grab:** Smooth scale transition (1.0 → 1.2)
- **Release:** Scale returns to normal
- **Throw:** Velocity based on movement speed

### Hover Detection
- Shows dashed circle when hovering over a shape
- Indicates the grab radius (50px + shape size/2)

## Technical Details

### Canvas Rendering
- **Size:** Full viewport (100vw × 100vh)
- **Background:** Dark theme `#0a0a12`
- **Frame Rate:** 60 FPS (requestAnimationFrame)

### Shape Drawing
Each shape is drawn using Canvas 2D API:
- **Circle:** `arc()` method
- **Square:** `fillRect()` and `strokeRect()`
- **Triangle:** 3-point path
- **Star:** 10-point path (5 outer + 5 inner)
- **Pentagon/Hexagon:** n-sided polygon paths
- **Diamond:** 4-point rhombus

### Performance
- Efficient rendering with `requestAnimationFrame`
- Minimal DOM manipulation (canvas only)
- Hardware-accelerated when possible

## Browser Support

### Required Features
- **Canvas 2D API** - All modern browsers
- **Pointer Events** - All modern browsers
- **ES6 JavaScript** - All modern browsers

### Tested On
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Usage

### Desktop
1. **Click and drag** any shape to grab it
2. **Move mouse** while holding to throw
3. **Release** to drop/throw
4. **Hover** to see grab radius

### Mobile/Touch
1. **Touch and hold** any shape
2. **Drag** to move it
3. **Release** to drop/throw

## Keyboard Shortcuts
- **None** - Pure mouse/touch interaction
- Use the UI buttons for reset and add shapes

## File Structure
```
shape-fall/
├── index.html    - 35 lines - Layout and controls
├── style.css     - 130 lines - Dark theme styling
└── script.js     - 415 lines - Physics engine
```

## Code Highlights

### Particle Class
```javascript
class Particle {
  constructor(x, y)
  update()           // Physics simulation
  draw()             // Canvas rendering
  drawShape()        // Shape-specific drawing
  drawStar()         // Complex star geometry
  drawPolygon()      // n-sided polygons
  contains(x, y)     // Collision detection
}
```

### Physics Constants
```javascript
const GRAVITY = 1.2
const FRICTION = 0.98
const BOUNCE = 0.65
const GRAB_RADIUS = 50
const LERP_SPEED = 0.3
```

## Credits

**Created:** 2026-07-31  
**Part of:** Fidget Toys Collection  
**License:** See parent project

## Related Toys

- **Particle Magnet** - Magnetic field effect
- **Geometric Gravity** - Device tilt physics
- **Thock Switch** - Mechanical keyboard switch
- **Flick Targets** - Tap and pop orbs
- **Audio Waveform** - Sound visualization

---

**Enjoy watching shapes fall!** 🎨✨
