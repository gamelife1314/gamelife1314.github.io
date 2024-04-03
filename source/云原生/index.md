---
title: 云原生
date: 2024-01-01 14:07:02
---

### 系列文章

1. [容器技术探索](/2023/12/22/Docker/create-contaienr-with-linux-original-tech/)
2. [单机容器网络](/2023/12/09/Network/container-network-single-host/)
3. [跨主机容器网络](/2023/12/12/Network/container-network-cross-host/)
4. [容器运行时介绍](/2023/12/20/K8S/container-runtime/)
5. [Iptables 介绍](/2023/12/25/Network/iptables-introduce-and-practice/)
6. [K8S 集群部署](/2023/12/17/K8S/kubeadm-deploy/)
7. [K8S CNI 网络](/2023/12/29/K8S/k8s-cni-network/)
8. [K8S 作业管理](/2024/01/10/K8S/k8s-job-manage/)
9. [K8S 证书管理](/2024/02/29/K8S/cert-manage-service/)
10. [K8S Gateway](/2024/03/01/K8S/gateway/)
11. [Istio 实战笔记](/2024/03/04/K8S/istio/)
12. [K8S 服务&Ingress](/2024/01/02/K8S/k8s-service/)
13. [K8S 持久化与数据挂载](/2024/01/17/K8S/k8s-data-mount/)

### 常用命令

#### kubectl

1. 污点添加和去除：
    > `kubectl taint nodes ctrlnode node-role.kubernetes.io/control-plane:NoSchedule`
    > `kubectl taint nodes ctrlnode node-role.kubernetes.io/control-plane:NoSchedule-`

2. 节点标签：
    > `kubectl label node node1 node-role.kubernetes.io/worker=worker`
    > `kubectl label nodes ctrlnode pvtype-`

3. 根据标签查询`Pod`：
    > `kubectl get pods -l app=nginx -owide`

4. `Pod`扩缩容：
    > `kubectl scale --current-replicas=2 --replicas=3 deployment/nginx-deployment`

5. 查询`Pod`中的容器：
    > `kubectl get pods nginx-deployment-848dd6cfb5-2gvg9 -o jsonpath={.spec.containers[*].name}`

6. 进入`Pod`中的容器：
    > `kubectl exec nginx-deployment-848dd6cfb5-2gvg9 -n default -it -c nginx -- /bin/bash`
    > `kubectl -n kube-system exec ds/cilium -- cilium status`

7. `Service`创建：
    > 从`deploy`创建服务
    > `kubectl expose deploy nginx-deployment --port=8080 --target-port=80 --type=ClusterIP --name=nginx-deploy-clusterip-svc`

8. 创建`Pod`：
    > 创建并且Attach
    > `kubectl run mytools -it --rm --image=praqma/network-multitool --image-pull-policy=IfNotPresent --command -- /bin/bash`
    > 仅创建
    > `kubectl run mytools --image=praqma/network-multitool --image-pull-policy=IfNotPresent`

9. 更新镜像：
    > `kubectl set image -n deploy-test deployment/nginx-deploy nginx=nginx:1.16.1 --record`
    > `kubectl patch statefulset nginx-sts --type='json' -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/image", "value":"nginx:1.16.1"}]'`

10. 滚动更新历史：
    > `kubectl rollout history -n deploy-test deployment/nginx-deploy`

11. 回滚:
    > `kubectl rollout undo -n deploy-test deployment/nginx-deploy --to-revision=1`

12. 重启 `Deploy`：
    > `kubectl rollout restart deployment cert-manager -n cert-manager`

#### crictl

1. 查询容器`PID`：
    > `crictl inspect -o go-template --template "{{ .info.pid }}" 15f86364ed865`

2. 进入容器：
    > `nsenter -a -t $(crictl inspect -o go-template --template '{{.info.pid}}' 6a5985ec11357)`

#### ctr

1. 导入镜像：

    > `ctr images import --platform linux/amd64 --base-name michael/netperf michael_netperf.tar`

#### docker

1. 查询容器`PID`：
    > `docker inspect --format "{{ .State.Pid }}" 52d2b3478c88`

2. 导出镜像
    > `docker save -o michael_netperf.tar michael/netperf:arm64 michael/netperf:amd64`
    > `gzip michael_netperf.tar`

3. 导入镜像
    > `docker load < busybox.tar.gz`
    > `docker load --input fedora.tar`

4. [跨平台镜像编译](https://docs.docker.com/build/building/multi-platform/)
    > `docker run --privileged --rm tonistiigi/binfmt --install all`
    > `docker buildx build --platform linux/arm64 -t michael/netperf --load .`

5. 删除 `<none>` 镜像：
    > `docker rmi -f $(docker images -f "dangling=true" -q)`

6. 镜像编译设置代理：
    > 设置代理
    > `docker build -t rb-dev:musl --build-arg https_proxy=http://1127.0.0.1:3128 --build-arg http_proxy=http://127.0.0.1:3128 .`


### 常用链接

1. [预编译通用CNI插件下载地址](https://github.com/containernetworking/plugins/releases)