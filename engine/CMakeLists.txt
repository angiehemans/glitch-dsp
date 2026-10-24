include(FetchContent)

FetchContent_Declare(juce
    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
    GIT_TAG 8.0.15 # 8.0.9 crashes serving the bundled UI on Linux (WebView IPC bug, fixed in 8.0.11)
    GIT_SHALLOW TRUE)
FetchContent_MakeAvailable(juce)

# TODO(M1): NeuralAmpModelerCore and its Eigen dependency go here (FetchContent + target_link_libraries).

juce_add_gui_app(Glitch
    PRODUCT_NAME "Glitch"
    COMPANY_NAME "Glitch"
    BUNDLE_ID "com.example.glitch" # TODO: placeholder, ask Angie for the real bundle ID
    VERSION ${PROJECT_VERSION}
    MICROPHONE_PERMISSION_ENABLED TRUE
    MICROPHONE_PERMISSION_TEXT "Glitch needs audio input to process your instrument."
    NEEDS_WEB_BROWSER TRUE
    NEEDS_CURL FALSE)

target_sources(Glitch PRIVATE
    src/Main.cpp
    src/MainComponent.cpp
    src/bridge/WebUi.cpp
    src/audio/Engine.cpp
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
        # TODO(M1): NeuralAmpModelerCore
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
