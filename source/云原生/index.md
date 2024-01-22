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
8. [K8S 服务&Ingress](/2024/01/02/K8S/k8s-service/)
9. [K8S 作业管理](/2024/01/10/K8S/k8s-job-manage/)
10. [K8S 持久化与数据挂载](/2024/01/17/K8S/k8s-data-mount/)

### 常用命令

#### kubectl

1. 污点去除：
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
8. 创建`Pod`并执行命令：
    > `kubectl run mytools -it --rm --image=praqma/network-multitool --image-pull-policy=IfNotPresent --command -- /bin/bash`
9. 更新镜像：
    > `kubectl set image -n deploy-test deployment/nginx-deploy nginx=nginx:1.16.1 --record`
    > `kubectl patch statefulset nginx-sts --type='json' -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/image", "value":"nginx:1.16.1"}]'`
10. 滚动更新历史：
    > `kubectl rollout history -n deploy-test deployment/nginx-deploy`
11. 回滚:
    > `kubectl rollout undo -n deploy-test deployment/nginx-deploy --to-revision=1`

#### crictl

1. 查询容器`PID`：
    > `crictl inspect -o go-template --template "{{ .info.pid }}" 15f86364ed865`

#### docker

1. 查询容器`PID`：
    > `docker inspect --format "{{ .State.Pid }}" 52d2b3478c88`