cmake_minimum_required(VERSION 3.22)

# Must be set before project(). The show Mac runs Monterey 12.7.6.
set(CMAKE_OSX_DEPLOYMENT_TARGET "12.0" CACHE STRING "Minimum macOS version")

project(Glitch VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(GLITCH_UI_DEV_URL "" CACHE STRING "Load the UI from this dev server URL. Empty serves the bundled ui/dist.")
option(GLITCH_BUILD_UI "Build ui/dist with npm and bundle it into the app" ON)

add_subdirectory(engine)
