# Terminal Pro Packaging

This readme explains how to package pro terminals on various operating systems.

## MacOS
Mac installer heavily influenced by [this](https://github.com/KosalaHerath/macos-installer-builder).

To use with OpenBB Workspace run the following (ON MAC):
1. Change directories to the terminal-pro: `pwd` should end with `terminalpro-poc`
1. Create the build: `cargo tauri build`
1. Create the package: `bash packaging/macOS/build-macos.sh openbbpro 0.0.1`

The following are helpful resources in trying to solve issues:
- [Apple Documentation](https://developer.apple.com/library/archive/documentation/DeveloperTools/Reference/DistributionDefinitionRef/Chapters/Distribution_XML_Ref.html#//apple_ref/doc/uid/TP40005370-CH100-SW8)
- [Relevant Github Issue](https://github.com/KosalaHerath/macos-installer-builder/issues/7)
- [3rd Party Docs](http://s.sudre.free.fr/Stuff/Ivanhoe/FLAT.html)
- [Summary SO Post](https://stackoverflow.com/questions/11487596/making-macos-installer-packages-which-are-developer-id-ready)

**NOTE**: Press cmd + l to see the logs while the installer runs. Make sure to select the option
thats shows all (and not just errors). Toward the bottom of the logs you will see a message that
says "touched file: [path]". This is where your installation occurred.
