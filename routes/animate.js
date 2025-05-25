const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Get directories from environment or use defaults
const MANIM_DIR = process.env.MANIM_DIR || path.join(process.cwd(), 'manim_files');
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(process.cwd(), 'public', 'videos');

// Create directories if they don't exist
if (!fs.existsSync(MANIM_DIR)) {
  fs.mkdirSync(MANIM_DIR, { recursive: true });
}

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Generate a Python file with Manim code based on user input
function generateManimCode(text) {
  // Basic template for Manim animation
  return `
from manim import *

class TextAnimation(Scene):
    def construct(self):
        # Create text object
        text = Text("${text.replace(/"/g, '\\"')}")
        
        # Animation sequence
        self.play(Write(text))
        self.wait(1)
        self.play(text.animate.scale(1.5))
        self.wait(1)
        self.play(text.animate.set_color(BLUE))
        self.wait(1)
        self.play(FadeOut(text))
`;
}

// API endpoint to create animation from text
router.post('/create-animation', async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }
      
      // Generate unique ID for this animation
      const animationId = uuidv4();
      const pythonFilePath = path.join(MANIM_DIR, `${animationId}.py`);
      
      // Generate and save the Python file
      const manimCode = generateManimCode(text);
      fs.writeFileSync(pythonFilePath, manimCode);
      
      // Run Manim to create the animation
      const manimProcess = spawn('python', [
        '-m', 'manim',
        pythonFilePath,
        'TextAnimation',
        '-qm',  // Medium quality
        '--media_dir', OUTPUT_DIR
      ]);
      
      let errorOutput = '';
      
      manimProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error(`Manim error: ${data}`);
      });
      
      manimProcess.on('close', (code) => {
        if (code !== 0) {
          return res.status(500).json({ 
            error: 'Failed to create animation', 
            details: errorOutput 
          });
        }
        
        // Manim output naming convention
        const videoFileName = `TextAnimation.mp4`;
        const videoPath = path.join(OUTPUT_DIR, videoFileName);
        
        // Rename the file to use our unique ID
        const newVideoPath = path.join(OUTPUT_DIR, `${animationId}.mp4`);
        
        if (fs.existsSync(videoPath)) {
          fs.renameSync(videoPath, newVideoPath);
          
          // Return the URL to access the video
          res.json({ 
            success: true, 
            videoUrl: `/videos/${animationId}.mp4` 
          });
        } else {
          res.status(500).json({ 
            error: 'Video file was not created', 
            details: errorOutput 
          });
        }
      });
    } catch (error) {
      console.error('Server error:', error);
      res.status(500).json({ error: 'Server error', details: error.message });
    }
  });

module.exports = router;