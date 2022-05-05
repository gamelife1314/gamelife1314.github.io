---
title: 【dapr】应用的本地开发与调试
date: 2021-12-12 21:04:05
tags:
    - dapr
---

本文借助 visual studio code 搭建本地的 dapr 应用开发环境，另外讲述本地调试技巧，便于问题定位。

{% asset_img WX20211212-210735.png %}

还是来调试 dapr 为我们准备的示例应用，[secretstore](https://github.com/dapr/quickstarts/tree/v1.0.0/secretstore)，我们先将本地的 dapr 按照官方指导运行起来，并且将示例应用克隆到本地打开，另外还需安装好 [Dapr Visual Studio Code扩展 ](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-dapr)，并且执行 `npm install` 命令安装将应用的扩展，当所有就绪之后你的工作区应该看起来如下所示：

<!-- more -->

{% asset_img workspace-ready.png 工作区Ready示例 %}

首先需要创建 `launch.json` 文件，按照下图所示点击创建：

![](create-launchjson.png)

执行 `cmd+shift+p` 调出 vscode 命令选择框，选择 `Scaffold Dapr Tasks`，然后依次选择选择 `launch`，并且输入应用名和端口号确定：

![](dapr-tasks.png)

在运行应用之前，需要将必要的秘钥存储组件复制到 `~/.dapr/components` 目录下，如下所示：

![](copy-secrets-store.png)

运行应用：

![](launch-app.png)

设置断点并且输入调试路径：

![](input-path.png)

单步调试，查看调用栈：

![](breakpoint.png)