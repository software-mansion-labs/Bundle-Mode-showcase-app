# Bundle Mode Showcase App

This is an app that showcases the use of `react-native-worklets` Bundle Mode feature. To read more about this feature [check the documentation](https://docs.swmansion.com/react-native-worklets/docs/bundleMode).

## Overview

It showcases two examples:

- A GPU animation running on a background thread, fetching geometry from the network, using `react-native-wgpu`, `three.js`, and `axios`.
- A GraphQL client running on a background thread, fetching data from a public GraphQL API, using `@apollo/client` and `graphql`.

Aforementioned libraries can be run on background threads, on Worklet runtimes, because they are allowlisted in the [Babel config](babel.config.js) of this project.

You can find detailed instructions on how to enable the Bundle Mode in your project [here](https://docs.swmansion.com/react-native-worklets/docs/bundleMode/setup).

## Running the app

### Installing dependencies

Install all the necessary dependencies with `yarn`.

```sh
yarn
```

If you have trouble with that step, it probably means that you need to enable `corepack` first:

```sh
corepack enable && yarn
```

### Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
yarn start
```

### Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

#### Android

```sh
yarn android
```

#### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.
