const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
require('dotenv').config();

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDtznLMaXpsv1rCcJmV59ohGVN61kkYD9M';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent';

// Flag to track if Gemini API is available - can be disabled via environment variable
let isGeminiAvailable = process.env.ENABLE_GEMINI_API !== 'false';

console.log(`Gemini API ${isGeminiAvailable ? 'enabled' : 'disabled'} at startup`);

const router = express.Router();

// Get directories from environment or use defaults
const MANIM_DIR = process.env.MANIM_DIR || path.join(process.cwd(), 'manim_files');
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(process.cwd(), 'public', 'outputs');

// Create directories if they don't exist
if (!fs.existsSync(MANIM_DIR)) {
  fs.mkdirSync(MANIM_DIR, { recursive: true });
}

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Generate a Python file with Manim code based on user input using Gemini API
async function generateManimCode(prompt) {
  // If we already know Gemini is unavailable or disabled via env, use the fallback immediately
  if (!isGeminiAvailable) {
    console.log('Using fallback animation generator (Gemini API unavailable or disabled)');
    return generateFallbackManimCode(prompt);
  }
  
  try {
    // Create a detailed prompt that instructs Gemini to generate proper Manim animations
    const fullPrompt = `You are a Manim animation expert. Generate Python Manim code for the following request: "${prompt}"

IMPORTANT REQUIREMENTS:
1. Create a Scene class that inherits from Scene
2. Use appropriate Manim objects and animations based on the request
3. For mathematical content: use MathTex, Tex, or mathematical objects
4. For text: use Text or Paragraph objects  
5. For shapes: use Circle, Square, Rectangle, Line, etc.
6. For graphs: use Axes, NumberPlane, FunctionGraph
7. Include smooth animations with proper timing (use self.wait() between animations)
8. Use colors, transformations, and positioning to make it visually appealing
9. The animation should be 10-15 seconds long with multiple animation steps

ANIMATION TECHNIQUES TO USE:
- Write(), FadeIn(), FadeOut() for text/objects appearing/disappearing
- Transform(), ReplacementTransform() for morphing objects
- Create(), DrawBorderThenFill() for drawing shapes
- MoveToTarget(), animate.shift(), animate.rotate() for movements  
- animate.scale(), animate.set_color() for transformations

EXAMPLES OF WHAT TO CREATE:
- If user asks for "sine wave": Create axes, draw sine function, show equation
- If user asks for "Pythagorean theorem": Show triangle, squares, equation, proof steps
- If user asks for "solar system": Create planets, orbits, animations
- If user asks for "sorting algorithm": Show array, demonstrate sorting steps

Return ONLY the Python code with no markdown formatting or explanations.`;
    
    // Generate content using Gemini API via direct API call
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: fullPrompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7, // Increased for more creativity
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 4096 // Increased for longer code
        }
      }
    );
    
    // Extract the generated text from the response
    let manimCode = response.data.candidates[0].content.parts[0].text;
    
    // Extract code if it's wrapped in markdown code blocks
    if (manimCode.includes('```python')) {
      manimCode = manimCode.split('```python')[1].split('```')[0].trim();
    } else if (manimCode.includes('```')) {
      manimCode = manimCode.split('```')[1].split('```')[0].trim();
    }
    
    // Validate that the code contains essential Manim elements
    if (!manimCode.includes('from manim import') || !manimCode.includes('class') || !manimCode.includes('Scene')) {
      console.log('Generated code appears invalid, using fallback');
      return generateFallbackManimCode(prompt);
    }
    
    console.log('Generated Manim code:', manimCode);
    return manimCode;
  } catch (error) {
    console.error('Error generating Manim code with Gemini:', error);
    
    // Check if the error is due to quota limits or API issues
    if (error.response && error.response.data) {
      const errorData = error.response.data;
      if (errorData.error && 
          (errorData.error.code === 429 || 
           errorData.error.message.includes('quota') ||
           errorData.error.message.includes('limit'))) {
        console.log('Gemini API quota exceeded, disabling API for future requests');
        isGeminiAvailable = false;
      }
    }
    
    // Use fallback animation generator
    return generateFallbackManimCode(prompt);
  }
}

// Improved fallback function to generate more sophisticated Manim code
function generateFallbackManimCode(text) {
  console.log('Using enhanced fallback animation generator');
  
  // Determine animation type based on keywords in the text
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('math') || lowerText.includes('equation') || lowerText.includes('formula')) {
    return generateMathFallback(text);
  } else if (lowerText.includes('graph') || lowerText.includes('function') || lowerText.includes('plot')) {
    return generateGraphFallback(text);
  } else if (lowerText.includes('shape') || lowerText.includes('circle') || lowerText.includes('square')) {
    return generateShapeFallback(text);
  } else {
    return generateTextFallback(text);
  }
}

function generateTextFallback(text) {
  return `
from manim import *

class TextAnimation(Scene):
    def construct(self):
        # Create title
        title = Text("${text.replace(/"/g, '\\"')}", font_size=48)
        title.to_edge(UP)
        
        # Create main content
        content = Text("Custom Animation", font_size=36)
        content.set_color(BLUE)
        
        # Create decorative elements
        circle = Circle(radius=2, color=YELLOW)
        circle.surround(content)
        
        # Animation sequence
        self.play(Write(title))
        self.wait(0.5)
        self.play(FadeIn(content))
        self.wait(0.5)
        self.play(Create(circle))
        self.wait(1)
        self.play(content.animate.set_color(RED), circle.animate.set_color(GREEN))
        self.wait(1)
        self.play(content.animate.scale(1.5), circle.animate.scale(1.2))
        self.wait(1)
        self.play(FadeOut(title), FadeOut(content), FadeOut(circle))
`;
}

function generateMathFallback(text) {
  return `
from manim import *

class MathAnimation(Scene):
    def construct(self):
        # Create mathematical expression
        equation = MathTex(r"f(x) = x^2 + 2x + 1")
        equation.scale(1.5)
        equation.set_color(BLUE)
        
        # Create title
        title = Text("${text.replace(/"/g, '\\"')}", font_size=36)
        title.to_edge(UP)
        
        # Animation sequence
        self.play(Write(title))
        self.wait(0.5)
        self.play(Write(equation))
        self.wait(1)
        
        # Transform to factored form
        factored = MathTex(r"f(x) = (x + 1)^2")
        factored.scale(1.5)
        factored.set_color(GREEN)
        
        self.play(Transform(equation, factored))
        self.wait(2)
        self.play(FadeOut(title), FadeOut(equation))
`;
}

function generateGraphFallback(text) {
  return `
from manim import *

class GraphAnimation(Scene):
    def construct(self):
        # Create title
        title = Text("${text.replace(/"/g, '\\"')}", font_size=36)
        title.to_edge(UP)
        
        # Create axes
        axes = Axes(
            x_range=[-3, 3, 1],
            y_range=[-2, 10, 2],
            axis_config={"color": BLUE}
        )
        
        # Create function
        graph = axes.plot(lambda x: x**2, color=YELLOW)
        
        # Create labels
        graph_label = axes.get_graph_label(graph, label="y = x^2")
        
        # Animation sequence
        self.play(Write(title))
        self.wait(0.5)
        self.play(Create(axes))
        self.wait(0.5)
        self.play(Create(graph))
        self.wait(0.5)
        self.play(Write(graph_label))
        self.wait(2)
        self.play(FadeOut(title), FadeOut(axes), FadeOut(graph), FadeOut(graph_label))
`;
}

function generateShapeFallback(text) {
  return `
from manim import *

class ShapeAnimation(Scene):
    def construct(self):
        # Create title
        title = Text("${text.replace(/"/g, '\\"')}", font_size=36)
        title.to_edge(UP)
        
        # Create shapes
        circle = Circle(radius=1, color=RED)
        square = Square(side_length=2, color=BLUE)
        triangle = Triangle(color=GREEN)
        
        # Position shapes
        circle.shift(LEFT * 2)
        triangle.shift(RIGHT * 2)
        
        # Animation sequence
        self.play(Write(title))
        self.wait(0.5)
        self.play(Create(circle), Create(square), Create(triangle))
        self.wait(1)
        self.play(
            circle.animate.set_fill(RED, opacity=0.5),
            square.animate.set_fill(BLUE, opacity=0.5),
            triangle.animate.set_fill(GREEN, opacity=0.5)
        )
        self.wait(1)
        self.play(
            circle.animate.shift(UP),
            square.animate.rotate(PI/4),
            triangle.animate.shift(DOWN)
        )
        self.wait(1)
        self.play(FadeOut(title), FadeOut(circle), FadeOut(square), FadeOut(triangle))
`;
}

// API endpoint to create animation from text
router.post('/create-animation', async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }
      
      console.log(`Creating animation for: "${text}"`);
      
      // Generate unique ID for this animation
      const animationId = uuidv4();
      const pythonFilePath = path.join(MANIM_DIR, `${animationId}.py`);
      
      // Generate and save the Python file using Gemini API
      const manimCode = await generateManimCode(text);
      fs.writeFileSync(pythonFilePath, manimCode);
      
      console.log(`Python file created at: ${pythonFilePath}`);
      console.log(`Attempting to run Manim at ${new Date().toISOString()}`);
      
      // Extract the class name from the generated code
      const classNameMatch = manimCode.match(/class\s+(\w+)\s*\(\s*Scene\s*\)/i);
      const className = classNameMatch ? classNameMatch[1] : 'TextAnimation';
      
      console.log(`Using class name: ${className}`);
      
      // Run Manim to create the animation with better parameters
      const manimProcess = spawn('python', [
        '-m', 'manim',
        pythonFilePath,
        className,
        '-qm',  // Medium quality
        '--media_dir', OUTPUT_DIR,
        '--disable_caching' // Disable caching to ensure fresh renders
      ], {
        cwd: process.cwd(),
        env: { ...process.env }
      });
      
      let errorOutput = '';
      let stdOutput = '';
      
      manimProcess.stdout.on('data', (data) => {
        stdOutput += data.toString();
        console.log(`Manim stdout: ${data}`);
      });
      
      manimProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error(`Manim stderr: ${data}`);
      });
      
      manimProcess.on('close', (code) => {
        console.log(`Manim process exited with code: ${code}`);
        
        if (code !== 0) {
          console.error('Manim failed with error:', errorOutput);
          return res.status(500).json({ 
            error: 'Failed to create animation', 
            details: errorOutput,
            stdout: stdOutput
          });
        }
        
        // Look for the video file in multiple possible locations
        const possiblePaths = [
          path.join(OUTPUT_DIR, 'videos', `${animationId}`, '720p30', `${className}.mp4`),
          path.join(OUTPUT_DIR, 'videos', '720p30', `${className}.mp4`),
          path.join(OUTPUT_DIR, `${className}.mp4`),
          path.join(MANIM_DIR, 'media', 'videos', `${animationId}`, '720p30', `${className}.mp4`)
        ];
        
        let videoPath = null;
        for (const path_option of possiblePaths) {
          if (fs.existsSync(path_option)) {
            videoPath = path_option;
            console.log(`Found video at: ${videoPath}`);
            break;
          }
        }
        
        if (!videoPath) {
          console.error('Video file not found in any expected location');
          console.log('Checked paths:', possiblePaths);
          
          // Try to find any mp4 files in the output directory
          try {
            const findMp4Files = (dir) => {
              const files = [];
              if (fs.existsSync(dir)) {
                const items = fs.readdirSync(dir);
                for (const item of items) {
                  const fullPath = path.join(dir, item);
                  if (fs.statSync(fullPath).isDirectory()) {
                    files.push(...findMp4Files(fullPath));
                  } else if (item.endsWith('.mp4')) {
                    files.push(fullPath);
                  }
                }
              }
              return files;
            };
            
            const mp4Files = findMp4Files(OUTPUT_DIR);
            console.log('Found MP4 files:', mp4Files);
            
            if (mp4Files.length > 0) {
              videoPath = mp4Files[mp4Files.length - 1]; // Use the most recent one
              console.log(`Using video file: ${videoPath}`);
            }
          } catch (err) {
            console.error('Error searching for MP4 files:', err.message);
          }
        }
        
        if (videoPath && fs.existsSync(videoPath)) {
          // Copy the file to the videos directory with the new name
          const newVideoPath = path.join(OUTPUT_DIR, `${animationId}.mp4`);
          fs.copyFileSync(videoPath, newVideoPath);
          console.log(`Video copied to: ${newVideoPath}`);
          
          // Return the URL to access the video
          res.json({ 
            success: true, 
            videoUrl: `/videos/${animationId}.mp4`,
            message: 'Animation created successfully!'
          });
        } else {
          res.status(500).json({ 
            error: 'Video file was not created successfully', 
            details: errorOutput,
            stdout: stdOutput
          });
        }
      });
      
      // Set a timeout to prevent hanging
      setTimeout(() => {
        if (!manimProcess.killed) {
          manimProcess.kill();
          res.status(500).json({ 
            error: 'Animation generation timed out',
            details: 'The process took too long to complete'
          });
        }
      }, 120000); // 2 minute timeout
      
    } catch (error) {
      console.error('Server error:', error);
      res.status(500).json({ 
        error: 'Server error', 
        details: error.message 
      });
    }
});

module.exports = router;