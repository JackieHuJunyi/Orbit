# Orbit icon critique

Rendered with `rsvg-convert` at 512, 64, 32, and 16 px. Scores are operational checks, not proof of taste.

| Candidate          | Subject |      Mass | 16px | Gestalt | Geometry | Centering | Contrast | Distinctiveness                                   | Verdict                                                  |
| ------------------ | ------: | --------: | ---: | ------: | -------: | --------: | -------: | ------------------------------------------------- | -------------------------------------------------------- |
| 1 Orbital link     |       2 | 2 (15.4%) |    3 |       2 |        4 |         3 |        5 | Collides with a chain link                        | Reject: center collapses into an accidental hole         |
| 2 Travelling peers |       2 | 3 (16.5%) |    3 |       2 |        3 |         3 |        5 | Nodes read as protrusions                         | Reject: silhouette becomes lumpy                         |
| 3 Orbital knot     |       4 | 3 (16.9%) |    4 |       4 |        4 |         3 |        5 | Close to a generic infinity mark                  | Keep as monochrome fallback                              |
| 4 Knot + nodes r1  |       4 | 2 (14.2%) |    4 |       4 |        4 |         5 |        5 | Nodes improve product meaning                     | Good silhouette, but misses the requested parallel paths |
| 5 Parallel orbits  |       4 | 2 (13.5%) |    4 |       4 |        5 |         4 |        5 | Distinct from a radial atom; some chain-link risk | Keep geometry; coral reads too much like a warning       |
| 6 Product finish   |       4 | 2 (13.5%) |    4 |       4 |        5 |         4 |        5 | Same distinctive silhouette, calmer material read | Selected: best color harmony at every rendered size      |

## Selected construction

Candidate 6 uses one continuous-corner Deep Space field (`#1D2834`), two equal Starlight paths (`#F4F2ED`) at one inclination, and one Mist Blue finish (`#9EBBCB`) for both equal planetary nodes. Its conservative bounding-box warning is accepted because the actual elliptical geometry avoids the box corners and the four rendered sizes remain uncropped. The icon should receive a final Icon Composer pass before App Store distribution; the flat SVG remains the durable source.
