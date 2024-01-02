---
title: Kubernetes Service
date: 2024-01-02 16:34:43
tags:
    - Service
    - NodePort
    - Loadblance
    - ExternalName
categories:
    - k8s
---

`Service`是`Kubernetes`中的资源类型，用来将一组`Pod`的应用作为网络服务公开。虽然每个`Pod`都有自己的`IP`，但是这个`IP`的生命周期与`Pod`生命周期一致，也就是说`Pod`销毁后这个`IP`也就无效了，而`Service`的`IP（ClusterIP）` 则是在创建之后便不会改变，`Service` 与 `Pod` 之前通过`iptables`和`ipvs`代理等手段关联。`k8s`一共提供了四种不同目的类型的`Service`，分别是`ClusterIP`、`NodePort`、`LoadBalancer`以及`ExternalName`，本来我们就来探索这四种服务的使用场景以及背后的使用原理。

`k8s` 集群中的每个节点都是运行一个[kube-proxy](https://kubernetes.io/zh-cn/docs/reference/networking/virtual-ips/)，它用于实现流量从`Service`到`Pod`之间的转发。默认在 `Linux` 平台下，它使用 `iptables` 作为后端实现，通过监听`Kubernetes`控制平面，获知对 `Service`和`EndpointSlice`对象的添加和删除操作，对于每个`Service`，`kube-proxy` 会添加 `iptables` 规则，在这些这些规则的加持下，流向`Service`的流量会被重新路由到`Service`后端集合中的其中之一。

### 准备工作

为了验证这里面是如何工作的，我们先创建`Pod`，`Service`，然后一步步分析`k8s`和操作系统互相配合，是如何将数据包转发到对应`Pod`里面的服务中去。第一步，我这里有三个可用节点，所以创建一个具有`3`个`Pod`的`nginx-deployment`：

> `kubectl apply -f https://k8s.io/examples/application/deployment-update.yaml`
> `kubectl scale --current-replicas=2 --replicas=3 deployment/nginx-deployment`

![](nginx-deployment-create.png)

然后我们使用下面的命令创建两个不同类型的`Service`：`ClusterIP`和`NodePort`，`NodePort`和`ClusterIP`不同的是，我们可以从集群外访问我们的服务：

> `kubectl expose deploy nginx-deployment --port=8080 --target-port=80 --type=ClusterIP --name=nginx-deploy-clusterip-svc`
> `kubectl expose deploy nginx-deployment --port=8081 --target-port=80 --type=NodePort --name=nginx-deploy-nodeport-svc`

![](nginx-service-create.png)

这两个两服务对应的后端`Pod`集合是完全相同的：

![](nginx-service-ep.png)

然后使用如下的命令创建一个`Pod`并且进入容器内进行验证：

> `kubectl run mytools -it --rm --image=praqma/network-multitool --image-pull-policy=IfNotPresent --command -- /bin/bash`

![](mytools-create.png)

在这个`Pod`中，可以使用`curl` 命令访问我们的服务，分别是 `10.109.146.68:8080` 和 `10.99.195.131:8081`。

### DNS

`k8s`集群创建的时候会创建一个`kube-dns`服务，用于对`Service`进行域名解析，每个`Service`都会被被自动分配一个 `<svc>.<namespace>.svc.<cluster-domain>` 格式的域名，在每个`Pod`中，也会存在关于域名解析的配置：

![](pod-dns-config.png)

这个文件中配置了多个`search`域，所以当我们写`nginx-deploy-clusterip-svc`、或者`nginx-deploy-clusterip-svc.default`，或者`nginx-deploy-clusterip-svc.default.svc`都是可以解析的：

![](nslookup-nginx-svc.png)

`ndots:5` 指的是如果域名中的`.`大于等于`5`个，则不走`search`域，目的是减少常规域名的解析次数。

### ClusterIP

我们来看当我们从`mytools`这个`Pod`访问我们的`nginx-deploy-clusterip-svc`时，它是怎么样一个过程：

![](mytools-curl-clusterip-svc.png)

`mytools`被调度了`node1`上：

```
root@ctrlnode:/home/ubuntu# kubectl get pods -owide
NAME                                READY   STATUS    RESTARTS   AGE     IP            NODE       NOMINATED NODE   READINESS GATES
mytools                             1/1     Running   0          3h16m   10.244.1.34   node1      <none>           <none>
nginx-deployment-848dd6cfb5-cfhcd   1/1     Running   0          3h49m   10.244.1.33   node1      <none>           <none>
nginx-deployment-848dd6cfb5-khjlq   1/1     Running   0          3h49m   10.244.0.14   ctrlnode   <none>           <none>
nginx-deployment-848dd6cfb5-q8gt6   1/1     Running   0          3h49m   10.244.2.23   node2      <none>           <none>
root@ctrlnode:/home/ubuntu#
```

从容器中发出去的报文出现在主机上时，一看系统的路由，也不知道如何处理，没有处理 `10.109.146.68` 的路由信息：

```
root@node1:/opt/cni/bin# route -n
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
0.0.0.0         192.168.67.1    0.0.0.0         UG    100    0        0 enp0s1
10.244.0.0      10.244.0.0      255.255.255.0   UG    0      0        0 flannel.1
10.244.1.0      0.0.0.0         255.255.255.0   U     0      0        0 cni0
10.244.2.0      10.244.2.0      255.255.255.0   UG    0      0        0 flannel.1
172.17.0.0      0.0.0.0         255.255.0.0     U     0      0        0 docker0
192.168.67.0    0.0.0.0         255.255.255.0   U     100    0        0 enp0s1
192.168.67.1    0.0.0.0         255.255.255.255 UH    100    0        0 enp0s1
root@node1:/opt/cni/bin#
```

所以就会流入默认网口`enp0s1`进行处理，按照我们对`iptables`的处理流程，这个包在处理之前会先触发`NF_INET_PRE_ROUTING`中的一系列钩子函数，对应于 `iptables` 中的 `PREROUTING` 链，我们使用 `iptables-save` 将 `node1` 上的所有规则打印出来，会发现和`10.109.146.68`相关的以下路由信息。首先是`nat`表中的`PREROUTING`链有这样一条规则，表示遍历自定义的`KUBE-SERVICES`中的所有规则，对于匹配的包做一些操作：

```shell
# 从PREROUTING链进入KUBE-SERVICES链
-A PREROUTING -m comment --comment "kubernetes service portals" -j KUBE-SERVICES
```

然后对于目标地址为`10.109.146.68`的报文进入`KUBE-SVC-ATSXPZA6MCLBTOSW`处理：

```shell
# 对于目标地址为10.109.146.68的报文进入KUBE-SVC-ATSXPZA6MCLBTOSW处理
-A KUBE-SERVICES -d 10.109.146.68/32 -p tcp -m comment --comment "default/nginx-deploy-clusterip-svc cluster IP" -j KUBE-SVC-ATSXPZA6MCLBTOSW

# 由于nginx-deploy-clusterip-svc有三个pod，所以做负载均衡，三个POD被访问的几率都是1/3
-A KUBE-SVC-ATSXPZA6MCLBTOSW ! -s 10.244.0.0/16 -d 10.109.146.68/32 -p tcp -m comment --comment "default/nginx-deploy-clusterip-svc cluster IP" -j KUBE-MARK-MASQ
-A KUBE-SVC-ATSXPZA6MCLBTOSW -m comment --comment "default/nginx-deploy-clusterip-svc -> 10.244.0.14:80" -m statistic --mode random --probability 0.33333333349 -j KUBE-SEP-DAKVPZ5FIFQ3YVFS
-A KUBE-SVC-ATSXPZA6MCLBTOSW -m comment --comment "default/nginx-deploy-clusterip-svc -> 10.244.1.33:80" -m statistic --mode random --probability 0.50000000000 -j KUBE-SEP-T5TBUFZUDZXN7HQI
-A KUBE-SVC-ATSXPZA6MCLBTOSW -m comment --comment "default/nginx-deploy-clusterip-svc -> 10.244.2.23:80" -j KUBE-SEP-FAOATOI7DC55LX55
```

当匹配到某个`POD`时，进入到对应的 `KUBE-SEP-*`，然后通过`DNAT`转换，就把访问`Service`的请求转换到了具体的`Pod`中，而`Pod`在不同节点之间本来就是互通的，是有路由信息的：

```shell
# 匹配到其中某个pod之后，进行DNAT转换，路由到了POD网络，POD网络
-A KUBE-SEP-DAKVPZ5FIFQ3YVFS -s 10.244.0.14/32 -m comment --comment "default/nginx-deploy-clusterip-svc" -j KUBE-MARK-MASQ
-A KUBE-SEP-DAKVPZ5FIFQ3YVFS -p tcp -m comment --comment "default/nginx-deploy-clusterip-svc" -m tcp -j DNAT --to-destination 10.244.0.14:80

-A KUBE-SEP-T5TBUFZUDZXN7HQI -s 10.244.1.33/32 -m comment --comment "default/nginx-deploy-clusterip-svc" -j KUBE-MARK-MASQ
-A KUBE-SEP-T5TBUFZUDZXN7HQI -p tcp -m comment --comment "default/nginx-deploy-clusterip-svc" -m tcp -j DNAT --to-destination 10.244.1.33:80

-A KUBE-SEP-FAOATOI7DC55LX55 -s 10.244.2.23/32 -m comment --comment "default/nginx-deploy-clusterip-svc" -j KUBE-MARK-MASQ
-A KUBE-SEP-FAOATOI7DC55LX55 -p tcp -m comment --comment "default/nginx-deploy-clusterip-svc" -m tcp -j DNAT --to-destination 10.244.2.23:80
```

根据`node1`节点上的路由信息，会把发往`10.244.0.0/16`、`10.244.2.0/16` 网络的报文通过 `flannel.1` 发出去，而发往 `10.244.1.0/16` 的报文由于在本机上，所以通过 `cni0` 网口就可以处理。这部分不懂的可以看[容器网络 - 跨主机容器通信](/2023/12/12/Network/container-network-cross-host/)以及[Kubernetes CNI 网络](/2023/12/29/K8S/k8s-cni-network/)。

在`node1`上的`iptables`规则中还能找到很多`KUBE-MARK-MASQ`相关的规则，这个链中的规则是用于做`SNAT`转换的，它的流程是这样的，在`PREROUTING`阶段使用`Mark`这个`Target`给要`SNAT`的包打上标记，在`POSTROUTING`阶段使用`MASQUERADE`做`SNAT`转换，`MASQUERADE`和`SNAT`这两个`iptables`的`Target`区别是，`SNAT`需要指定的具体的原地址，而`MASQUERADE`会动态获取报文发出去的网卡上的`IP`作为原地址。例如，当我们访问`10.109.146.68`的报文最终被路由到了`node2`，那么在从`node1`上的`enp0s1`网卡发送出去时，通过`MASQUERADE`将报文的原地址设置成`node1`上`enp0s1`网卡的地址。

```
-A KUBE-MARK-MASQ -j MARK --set-xmark 0x4000/0x4000

-A POSTROUTING -m comment --comment "kubernetes postrouting rules" -j KUBE-POSTROUTING
-A KUBE-POSTROUTING -j RETURN
-A KUBE-POSTROUTING -j MARK --set-xmark 0x4000/0x0
-A KUBE-POSTROUTING -m comment --comment "kubernetes service traffic requiring SNAT" -j MASQUERADE --random-fully
```

关于`MASQUERADE`的介绍可以看[这里](https://manpages.ubuntu.com/manpages/xenial/man8/iptables-extensions.8.html#target%20extensions)。

 ### NodePort

对于`NodePort`类型的`Service`，我们是可以通过每个节点的“公网”`IP`进行访问的，例如控制节点的`IP`是`192.168.67.6`，那么我们可以通过`192.168.67.6:31087`访问我们的服务：

![](ctrlnode-nodeport-svc.png)

通过浏览器进行访问：

![](browser-visit-nodeport-svc.png)

同理，我们先到处 `nat` 表中的 `PREROUTING` 链中的所有规则：

```
root@node1:/opt/cni/bin# iptables -t nat -L PREROUTING | column -t
Chain              PREROUTING  (policy  ACCEPT)
target             prot        opt      source    destination
KUBE-SERVICES      all         --       anywhere  anywhere     /*        kubernetes  service   portals  */
DOCKER             all         --       anywhere  anywhere     ADDRTYPE  match       dst-type  LOCAL
CNI-HOSTPORT-DNAT  all         --       anywhere  anywhere     ADDRTYPE  match       dst-type  LOCAL
```

然后会在`KUBE-SERVICES`链中最后一条是和`NodePort`相关的规则：

```
root@node1:/opt/cni/bin# iptables -t nat -L KUBE-SERVICES | column -t
Chain                      KUBE-SERVICES  (2   references)
target                     prot           opt  source       destination
...
KUBE-NODEPORTS             all            --   anywhere     anywhere        /*  kubernetes                                               service  nodeports;  NOTE:  this  must  be  the  last  rule  in  this  chain  */  ADDRTYPE  match  dst-type  LOCAL
```

`NodePort`链中的规则如下，只是简单跳转到了对应的`NodePort`服务的链中，奇怪的是这里没有匹配端口，对于第二条至少应该有 `tcp  dpt:31087` 这样的匹配条件：

```
root@node1:/opt/cni/bin# iptables -t nat -L KUBE-NODEPORTS  | column -t
Chain                      KUBE-NODEPORTS  (1   references)
target                     prot            opt  source       destination
KUBE-EXT-CEZPIJSAUFW5MYPQ  tcp             --   anywhere     anywhere     /*  kubernetes-dashboard/kubernetes-dashboard  */
KUBE-EXT-5KZKXYM2F4JEGSLN  tcp             --   anywhere     anywhere     /*  default/nginx-deploy-nodeport-svc          */
```

然后就是跳转到了对应的`Service`链中：

```
root@node1:/opt/cni/bin# iptables -t nat -L KUBE-EXT-5KZKXYM2F4JEGSLN  | column -t
Chain                      KUBE-EXT-5KZKXYM2F4JEGSLN  (1   references)
target                     prot                       opt  source       destination
KUBE-MARK-MASQ             all                        --   anywhere     anywhere     /*  masquerade  traffic  for  default/nginx-deploy-nodeport-svc  external  destinations  */
KUBE-SVC-5KZKXYM2F4JEGSLN  all                        --   anywhere     anywhere
```

到此就和`ClusterIP`类型的服务一样了：

```
root@node1:/opt/cni/bin# iptables -t nat -L KUBE-SVC-5KZKXYM2F4JEGSLN  | column -t
Chain                      KUBE-SVC-5KZKXYM2F4JEGSLN  (2   references)
target                     prot                       opt  source          destination
KUBE-MARK-MASQ             tcp                        --   !10.244.0.0/16  10.99.195.131  /*  default/nginx-deploy-nodeport-svc  cluster  IP              */
KUBE-SEP-UJUNIX4VZHZP6FA5  all                        --   anywhere        anywhere       /*  default/nginx-deploy-nodeport-svc  ->       10.244.0.14:80  */  statistic  mode  random  probability  0.33333333349
KUBE-SEP-T2NRS2PTKKMICKOV  all                        --   anywhere        anywhere       /*  default/nginx-deploy-nodeport-svc  ->       10.244.1.33:80  */  statistic  mode  random  probability  0.50000000000
KUBE-SEP-BA25566EWJRVI6PP  all                        --   anywhere        anywhere       /*  default/nginx-deploy-nodeport-svc  ->       10.244.2.23:80  */
```

### 参考链接

1. [Understanding networking in Kubernetes](https://learncloudnative.com/blog/2023-05-31-kubeproxy-iptables)
2. [Kubernetes Services and Iptables](https://msazure.club/kubernetes-services-and-iptables/)
3. [nftables 中文教程](https://icloudnative.io/posts/using-nftables/)
4. [Redhat - nftables 入门](https://access.redhat.com/documentation/zh-cn/red_hat_enterprise_linux/8/html/securing_networks/getting-started-with-nftables_securing-networks#doc-wrapper)
5. [kubernetes - 虚拟IP和服务代理](https://kubernetes.io/zh-cn/docs/reference/networking/virtual-ips/)
6. [Kubernetes Service iptables 网络通信验证](https://lotabout.me/2022/Kubernetes-Service-Model-Verification/)
7. [服务发现与负载均衡](https://jimmysong.io/kubernetes-handbook/practice/service-discovery-and-loadbalancing.html)
8. [Kubernetes LoadBalancer Service 与负载均衡器](https://atbug.com/k8s-service-and-load-balancer/)