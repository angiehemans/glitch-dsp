include(FetchContent)

FetchContent_Declare(juce
    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
    GIT_TAG 8.0.15 # 8.0.9 crashes serving the bundled UI on Linux (WebView IPC bug, fixed in 8.0.11)
    GIT_SHALLOW TRUE)
FetchContent_MakeAvailable(juce)

# NeuralAmpModelerCore, sources only: its own CMake builds benchmark tools. SOURCE_SUBDIR points
# nowhere so FetchContent_MakeAvailable downloads without add_subdirectory.
FetchContent_Declare(nam
    GIT_REPOSITORY https://github.com/sdatkinson/NeuralAmpModelerCore.git
    GIT_TAG v0.6.0
    GIT_SHALLOW TRUE
    GIT_SUBMODULES ""
    SOURCE_SUBDIR sources-only)
# Eigen (header-only) at the commit NAM v0.6.0 pins as its submodule.
FetchContent_Declare(eigen
    URL https://gitlab.com/libeigen/eigen/-/archive/bc3b39870ecb690a623a3f49149a358b95c5781d/eigen-bc3b39870ecb690a623a3f49149a358b95c5781d.tar.gz
    URL_HASH SHA256=5f6557d1aca6e959a4b955c55f2935261fd30de59c0c79e35bc6d5cbe1de22d1
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
    SOURCE_SUBDIR sources-only)
FetchContent_MakeAvailable(nam eigen)

file(GLOB NAM_SOURCES CONFIGURE_DEPENDS ${nam_SOURCE_DIR}/NAM/*.cpp ${nam_SOURCE_DIR}/NAM/*/*.cpp)
# An object library, not static: NAM registers each architecture from a static initialiser, which a
# static library would let the linker drop ("No config parser registered for architecture").
add_library(nam OBJECT ${NAM_SOURCES} src/blocks/NamModel.cpp)
target_include_directories(nam SYSTEM PRIVATE ${nam_SOURCE_DIR} ${nam_SOURCE_DIR}/Dependencies/nlohmann ${eigen_SOURCE_DIR})
target_compile_definitions(nam PRIVATE NAM_SAMPLE_FLOAT NAM_ENABLE_A2_FAST EIGEN_NO_DEBUG)
target_compile_features(nam PRIVATE cxx_std_20)
# Hidden symbols, here and on Glitch: plugins built on NAM or JUCE carry their own copies, and the
# loader would otherwise merge their inline statics with ours (a NAM-based AU aborted on load with
# NAM's registry already full).
set_target_properties(nam PROPERTIES POSITION_INDEPENDENT_CODE ON CXX_VISIBILITY_PRESET hidden VISIBILITY_INLINES_HIDDEN ON)
# Always optimised: unoptimised Eigen is far too slow for real time, even in a Debug build.
target_compile_options(nam PRIVATE -O3)
# AVX2 + FMA on Intel (the show Mac's Haswell i7 has both; Eigen is much faster with them).
# shortcut: assumes an AVX2 CPU (Intel 2013+, AMD 2015+); an older x86 machine would crash on load.
if(APPLE)
    target_compile_options(nam PRIVATE -Xarch_x86_64 -mavx2 -Xarch_x86_64 -mfma)
elseif(CMAKE_SYSTEM_PROCESSOR MATCHES "x86_64|AMD64")
    target_compile_options(nam PRIVATE -mavx2 -mfma)
endif()

juce_add_gui_app(Glitch
    PRODUCT_NAME "Glitch"
    COMPANY_NAME "Glitch"
    BUNDLE_ID "com.example.glitch" # TODO: placeholder, ask Angie for the real bundle ID
    VERSION ${PROJECT_VERSION}
    MICROPHONE_PERMISSION_ENABLED TRUE
    MICROPHONE_PERMISSION_TEXT "Glitch needs audio input to process your instrument."
    NEEDS_WEB_BROWSER TRUE
    NEEDS_CURL FALSE)
set_target_properties(Glitch PROPERTIES CXX_VISIBILITY_PRESET hidden VISIBILITY_INLINES_HIDDEN ON)

target_sources(Glitch PRIVATE
    src/Main.cpp
    src/MainComponent.cpp
    src/bridge/WebUi.cpp
    src/audio/Engine.cpp
    src/blocks/IrBlock.cpp
    src/blocks/ModelLibrary.cpp
    src/blocks/NamBlock.cpp
    src/plugins/PluginLibrary.cpp
    src/project/ProjectStore.cpp)

target_compile_definitions(Glitch PRIVATE
    JUCE_WEB_BROWSER=1
    JUCE_USE_CURL=0
    JUCE_PLUGINHOST_VST3=1
    JUCE_PLUGINHOST_AU=$<BOOL:${APPLE}>
    JUCE_APPLICATION_NAME_STRING="$<TARGET_PROPERTY:Glitch,JUCE_PRODUCT_NAME>"
    JUCE_APPLICATION_VERSION_STRING="$<TARGET_PROPERTY:Glitch,JUCE_VERSION>"
    GLITCH_UI_DEV_URL="${GLITCH_UI_DEV_URL}")

if(CMAKE_SYSTEM_NAME STREQUAL "Linux")
    target_compile_definitions(Glitch PRIVATE JUCE_JACK=1 JUCE_ALSA=1)
endif()

target_link_libraries(Glitch
    PRIVATE
        juce::juce_gui_extra
        juce::juce_audio_utils
        juce::juce_dsp
        nam
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags)

# Release: build the UI with npm, then copy ui/dist next to the app. A folder copy instead of
# juce_add_binary_data, because Vite's hashed filenames would force a re-configure on every UI build.
if(GLITCH_BUILD_UI AND GLITCH_UI_DEV_URL STREQUAL "")
    find_program(NPM npm REQUIRED)
    add_custom_target(GlitchUi ALL
        COMMAND ${NPM} run build -w ui
        WORKING_DIRECTORY ${PROJECT_SOURCE_DIR}
        USES_TERMINAL)
    add_dependencies(Glitch GlitchUi)

    if(APPLE)
        set(GLITCH_UI_DEST "$<TARGET_BUNDLE_CONTENT_DIR:Glitch>/Resources/ui")
    else()
        set(GLITCH_UI_DEST "$<TARGET_FILE_DIR:Glitch>/ui")
    endif()

    add_custom_command(TARGET Glitch POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E rm -rf "${GLITCH_UI_DEST}"
        COMMAND ${CMAKE_COMMAND} -E copy_directory "${PROJECT_SOURCE_DIR}/ui/dist" "${GLITCH_UI_DEST}")
endif()

# GlitchBench: the CPU cost of a NAM model or IR at 64/128/256 samples, using the app's blocks.
# Not built by default: cmake --build --preset release --target GlitchBench
juce_add_console_app(GlitchBench)
set_target_properties(GlitchBench PROPERTIES EXCLUDE_FROM_ALL TRUE)
target_sources(GlitchBench PRIVATE tools/Bench.cpp src/blocks/NamBlock.cpp src/blocks/IrBlock.cpp)
target_compile_definitions(GlitchBench PRIVATE JUCE_WEB_BROWSER=0 JUCE_USE_CURL=0)
target_link_libraries(GlitchBench
    PRIVATE
        nam
        juce::juce_audio_processors
        juce::juce_audio_formats
        juce::juce_dsp
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_warning_flags)

# GlitchScanTest: scans plugin bundles through the helper-process scanner. Not built by default:
# cmake --build --preset dev --target GlitchScanTest
juce_add_console_app(GlitchScanTest)
set_target_properties(GlitchScanTest PROPERTIES EXCLUDE_FROM_ALL TRUE)
target_sources(GlitchScanTest PRIVATE tools/ScanTest.cpp src/plugins/PluginLibrary.cpp)
target_compile_definitions(GlitchScanTest PRIVATE JUCE_WEB_BROWSER=0 JUCE_USE_CURL=0
    JUCE_PLUGINHOST_VST3=1 JUCE_PLUGINHOST_AU=$<BOOL:${APPLE}>)
target_link_libraries(GlitchScanTest
    PRIVATE
        juce::juce_audio_processors
        juce::juce_gui_basics
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_warning_flags)
