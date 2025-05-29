
from manim import *

class ShapeAnimation(Scene):
    def construct(self):
        # Create title
        title = Text("Create a circle that transforms into a square", font_size=36)
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
