
from manim import *

class TextAnimation(Scene):
    def construct(self):
        # Create text object
        text = Text("math animation")
        
        # Animation sequence
        self.play(Write(text))
        self.wait(1)
        self.play(text.animate.scale(1.5))
        self.wait(1)
        self.play(text.animate.set_color(BLUE))
        self.wait(1)
        self.play(FadeOut(text))
