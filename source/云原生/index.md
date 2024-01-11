---
title: 云原生
date: 2024-01-01 14:07:02
---

### 系列文章

1. [容器技术探索及实践](/2023/12/22/Docker/create-contaienr-with-linux-original-tech/)
2. [容器网络 - 单机容器通信](/2023/12/09/Network/container-network-single-host/)
3. [容器网络 - 跨主机容器通信](/2023/12/12/Network/container-network-cross-host/)
4. [容器运行时](/2023/12/20/K8S/container-runtime/)
5. [使用 kubeadm 创建多节点集群](/2023/12/17/K8S/kubeadm-deploy/)
6. [Kubernetes CNI 网络](/2023/12/29/K8S/k8s-cni-network/)
7. [深入理解 iptables](/2023/12/25/Network/iptables-introduce-and-practice/)
8. [Kubernetes Service](/2024/01/02/K8S/k8s-service/)

### 常用命令

#### kubectl

1. 污点去除：
    > `kubectl taint nodes ctrlnode node-role.kubernetes.io/control-plane:NoSchedule-`
2. 节点标签：
    > `kubectl label node node1 node-role.kubernetes.io/worker=worker`
3. 根据标签查询`Pod`：
    > `kubectl get pods -l app=nginx -owide`
4. `Pod`扩缩容：
    > `kubectl scale --current-replicas=2 --replicas=3 deployment/nginx-deployment`
5. `Pod`中容器：
    > `kubectl get pods nginx-deployment-848dd6cfb5-2gvg9 -o jsonpath={.spec.containers[*].name}`
6. 进入`Pod`中的容器：
    > `kubectl exec nginx-deployment-848dd6cfb5-2gvg9 -n default -it -c nginx -- /bin/bash`
7. `Pod`服务创建：
    > `kubectl expose deploy nginx-deployment --port=8080 --target-port=80 --type=ClusterIP --name=nginx-deploy-clusterip-svc`
8. 创建`Pod`：
    > `kubectl run mytools -it --rm --image=praqma/network-multitool --image-pull-policy=IfNotPresent --command -- /bin/bash`


#### crictl

1. 查询容器`PID`：
    > `crictl inspect -o go-template --template "{{ .info.pid }}" 15f86364ed865`