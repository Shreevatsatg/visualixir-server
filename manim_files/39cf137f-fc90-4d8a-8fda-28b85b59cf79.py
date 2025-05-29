
from manim import *

class TextAnimation(Scene):
    def construct(self):
        # Create title
        title = Text("dog dancing", font_size=48)
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
