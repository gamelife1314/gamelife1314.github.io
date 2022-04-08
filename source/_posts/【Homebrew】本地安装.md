---
title: 【Homebrew】本地安装
date: 2022-04-08 17:56:50
tags:
  - homebrew
---

为啥会有这篇文章呢，因为我通过 `brew` 安装一个编译器太慢了，虽然 `github` 相关的网站没有被 GFW 屏蔽，但是现在速度依然感人，`100MB` 的东西我得下一天。

我在执行命令 `brew install aarch64-unknown-linux-gnu` 时经常中断，气得我肝疼，挂代理也不行：

{% asset_img brew-install-failed.png %}

好在有一台香港的服务器，根据图片中的下载地址，我先从服务器上下载，然后 `scp` 到本地。通过 `brew --cache` 命令找到 `brew` 下载文件时的缓存目录：

```
~/WORKDIR/gamelife1314.github.io on  source! ⌚ 18:02:53
$ brew --cache
/Users/fudenglong/Library/Caches/Homebrew
```

这个目录下的文件都是链接到了 `"$(brew --cache)/downloads"` 中，可以在这个 `downloads` 找到我们未下载未完成的文件，用我们下载好的文件将它替换掉，替换的时候删除后缀 `.incomplete`。

{% asset_img brew-replace-incomplete-file.png %}

然后重新执行命令 `brew install aarch64-unknown-linux-gnu`，它会从断点处重传，看到已经下载完成了，就不会再下载了。

{% asset_img isntall-success.png %}

到这里其实就安装完成了，后面还有一些自动的依赖更新，我们可以通过设置环境变量 `HOMEBREW_NO_INSTALLED_DEPENDENTS_CHECK=1` 禁用这个行为。

