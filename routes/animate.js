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
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(process.cwd(), 'public', 'videos');

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
    // Create a prompt that instructs Gemini to generate Manim code
    const fullPrompt = `Generate Python Manim code for the following description: "${prompt}". 
    The code should:
    1. Import necessary Manim libraries
    2. Create a Scene class with a descriptive name
    3. Implement the construct method with appropriate animations
    4. Include comments explaining key parts
    
    Return ONLY the Python code with no additional text or explanations.`;
    
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
          temperature: 0.4,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 2048
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
    
    console.log('Generated Manim code:', manimCode);
    return manimCode;
  } catch (error) {
    console.error('Error generating Manim code with Gemini:', error);
    
    // Check if the error is due to quota limits
    if (error.response && error.response.data && 
        (error.response.data.error.code === 429 || 
         error.response.data.error.message.includes('quota'))) {
      console.log('Gemini API quota exceeded, disabling API for future requests');
      isGeminiAvailable = false;
    }
    
    // Use fallback animation generator
    return generateFallbackManimCode(prompt);
  }
}

// Fallback function to generate basic Manim code without using the API
function generateFallbackManimCode(text) {
  console.log('Using fallback animation generator');
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
      
      // Generate and save the Python file using Gemini API
      const manimCode = await generateManimCode(text);
      fs.writeFileSync(pythonFilePath, manimCode);
      
      console.log(`Attempting to run Manim with Python at ${new Date().toISOString()}`);
      console.log(`Python file path: ${pythonFilePath}`);
      console.log(`Output directory: ${OUTPUT_DIR}`);
      
      // Run Manim to create the animation
      // Extract the class name from the generated code
      const classNameMatch = manimCode.match(/class\s+(\w+)\s*\(\s*Scene\s*\)/i);
      const className = classNameMatch ? classNameMatch[1] : 'TextAnimation';
      
      console.log(`Using class name: ${className}`);
      
      const manimProcess = spawn('python', [
        '-m', 'manim',
        pythonFilePath,
        className,
        '-qm',  // Medium quality
        '--media_dir', OUTPUT_DIR
      ]);
      
      let errorOutput = '';
      let stdOutput = '';
      
      manimProcess.stdout.on('data', (data) => {
        stdOutput += data.toString();
        console.log(`Manim output: ${data}`);
      });
      
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
        
        // Manim output naming convention - Manim creates files in a nested structure
        const manimOutputDir = path.join(OUTPUT_DIR, 'videos', animationId, '720p30');
        const videoFileName = `${className}.mp4`;
        const videoPath = path.join(manimOutputDir, videoFileName);
        
        console.log(`Looking for video at: ${videoPath}`);
        
        // Create the destination directory if it doesn't exist
        if (!fs.existsSync(OUTPUT_DIR)) {
          fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }
        
        // Rename the file to use our unique ID
        const newVideoPath = path.join(OUTPUT_DIR, `${animationId}.mp4`);
        
        if (fs.existsSync(videoPath)) {
          // Copy the file to the videos directory with the new name
          fs.copyFileSync(videoPath, newVideoPath);
          console.log(`Video copied to: ${newVideoPath}`);
          
          // Return the URL to access the video
          res.json({ 
            success: true, 
            videoUrl: `/videos/${animationId}.mp4` 
          });
        } else {
          console.error(`Video file not found at: ${videoPath}`);
          console.error(`Checking directory contents of: ${manimOutputDir}`);
          
          try {
            if (fs.existsSync(manimOutputDir)) {
              const files = fs.readdirSync(manimOutputDir);
              console.log(`Files in directory: ${files.join(', ')}`);
            } else {
              console.error(`Directory does not exist: ${manimOutputDir}`);
            }
          } catch (err) {
            console.error(`Error reading directory: ${err.message}`);
          }
          
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