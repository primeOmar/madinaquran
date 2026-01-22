// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapacitorAgoraScreenshare",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapacitorAgoraScreenshare",
            targets: ["AgoraScreenSharePluginPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "AgoraScreenSharePluginPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/AgoraScreenSharePluginPlugin"),
        .testTarget(
            name: "AgoraScreenSharePluginPluginTests",
            dependencies: ["AgoraScreenSharePluginPlugin"],
            path: "ios/Tests/AgoraScreenSharePluginPluginTests")
    ]
)