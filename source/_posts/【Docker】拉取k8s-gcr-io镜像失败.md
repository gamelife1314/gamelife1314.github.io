---
title: 【Docker】拉取k8s.gcr.io镜像失败
date: 2022-04-02 21:23:15
tags:
  - docker
---

在部署k8s的时候，因为某些众所周知的原因，k8s.gcr.io 的镜像会拉取失败，本文示例一种或方式能正常拉取镜像，前提是你能科学上网，示例环境：

    ubuntu@vm-docker:~/workdir$ lsb_release -a
    No LSB modules are available.
    Distributor ID:	Ubuntu
    Description:	Ubuntu 21.10
    Release:	21.10
    Codename:	impish

为 `docker` 服务创建一个内嵌的 `systemd` 目录：

> mkdir -p /etc/systemd/system/docker.service.d

创建配置文件 `/etc/systemd/system/docker.service.d/http-proxy.conf`，并且写入以下内容；配置规则请看 [https://docs.docker.com/network/proxy/#use-environment-variables](https://docs.docker.com/network/proxy/#use-environment-variables)：

    ubuntu@vm-docker:~/workdir$ cat /etc/systemd/system/docker.service.d/http-proxy.conf
    [Service]
    Environment="HTTP_PROXY=http://192.168.3.100:1087"
    Environment="HTTPS_PROXY=http://192.168.3.100:1087"
    Environment="NO_PROXY=localhost,127.0.0.1,https://******.mirror.aliyuncs.com"

更新配置并且重启docker：

> systemctl daemon-reload && systemctl restart docker

验证配置加载成功：

    ubuntu@vm-docker:~/workdir$ sudo systemctl show --property=Environment docker
    Environment=HTTP_PROXY=http://192.168.3.100:1087 HTTPS_PROXY=http://192.168.3.100:1087 NO_PROXY=localhost,127.0.0.1,https://******.mirror.aliyuncs.com
    ubuntu@vm-docker:~/workdir$

测试镜像拉取：

{% asset_img WX20220402-213134@2x.png %}

### 参考文章

1. [下载k8s.gcr.io仓库的镜像的两个方式](https://developer.aliyun.com/article/795721)