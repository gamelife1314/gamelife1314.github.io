---
title: Docker 磁盘占用空间清理
date: 2023-12-22 09:34:36
tags:
    - 磁盘清理
categories:
    - Docker
---


记录几种用于清理 `Docker` 磁盘空间占用的几种方式。

1. 删除不想要的容器、网络、镜像以及构建缓存等，首先使用如下的命令查看 `Docker` 空间占用：

    > docker system df

    ```
    root@ctrlnode:/home/ubuntu# docker system df
    TYPE                TOTAL               ACTIVE              SIZE                RECLAIMABLE
    Images              15                  14                  2.332GB             13.26kB (0%)
    Containers          51                  22                  219B                104B (47%)
    Local Volumes       1                   0                   0B                  0B
    Build Cache         0                   0                   0B                  0B
    ```

    如果使用 `-v` 参数可以查看更具体的每个镜像，容器的占用。使用 `docker system prune` 命令删除停止状态的容器，未关联容器的网络以及 `dangling` 镜像，如果使用 `-a` 参数，还将清除未使用的镜像，`-f` 表示强制操作:

    > docker system prune -a -f

    如果仅仅是删除未使用的和`dangling` 镜像使用：

    > docker image prune -a

    类似的，下面的两条命令用于清除停止的容器以及未使用的卷：

    > docker container prune
    > docker volume prune

2. 仅删除 `dangling` 镜像：

    > docker rmi $(docker images -f "dangling=true" -q) 

    如果是删除退出的容器：

    > docker rm -v $(docker ps -aq -f status=exited)

3. 清理日志，编辑文件：`/etc/docker/daemon.json`：

    > vi /etc/docker/daemon.json 
    
    添加下面这些配置：

    ```
    { "log-driver":"json-file", "log-opts": {"max-size":"3m", "max-file":"1"} } 
    ```
    重启:
    > systemctl daemon-reload systemctl restart docker

4. `k8s` 环境的清理，首先驱逐节点：

    > kubectl drain this_node --ignore-daemonsets --delete-local-data 

    停止 `kubelet` 服务：

    > kubelet stop 

    重启 `Docker`：

    > service docker restart

    清理 `Docker`：

    > docker system prune --all --volumes --force

5. 相当于重装 `Docker`：

    > systemctl stop docker
    > rm -rf /var/lib/docker
    > systemctl start docker

