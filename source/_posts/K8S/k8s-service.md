---
title: Kubernetes Service & Ingress
date: 2024-01-02 16:34:43
tags:
    - Service
    - NodePort
    - Loadblance
    - ExternalName
    - Ingress
    - MetaLB
categories:
    - k8s
---

`Service`是`Kubernetes`中的资源类型，用来将一组`Pod`的应用作为网络服务公开。虽然每个`Pod`都有自己的`IP`，但是这个`IP`的生命周期与`Pod`生命周期一致，也就是说`Pod`销毁后这个`IP`也就无效了，而`Service`的`IP（ClusterIP）` 则是在创建之后便不会改变，`Service` 与 `Pod` 之前通过`iptables`和`ipvs`代理等手段关联。`k8s`一共提供了四种不同目的类型的`Service`，分别是`ClusterIP`、`NodePort`、`LoadBalancer`以及`ExternalName`，本来我们就来探索这四种服务的使用场景以及背后的使用原理。

`k8s` 集群中的每个节点都是运行一个[kube-proxy](https://kubernetes.io/zh-cn/docs/reference/networking/virtual-ips/)，它用于实现流量从`Service`到`Pod`之间的转发。默认在 `Linux` 平台下，它使用 `iptables` 作为后端实现，通过监听`Kubernetes`控制平面，获知对 `Service`和`EndpointSlice`对象的添加和删除操作，对于每个`Service`，`kube-proxy` 会添加 `iptables` 规则，在这些这些规则的加持下，流向`Service`的流量会被重新路由到`Service`后端集合中的其中之一。

四种模式的基本工作原理如下图所示：

{% asset_img k8s-four-services.png %}

<!-- more -->

### 准备工作

为了验证这里面是如何工作的，我们先创建`Pod`，`Service`，然后一步步分析`k8s`和操作系统互相配合，是如何将数据包转发到对应`Pod`里面的服务中去。第一步，我这里有三个可用节点，所以创建一个具有`3`个`Pod`的`nginx-deployment`：

> `kubectl apply -f https://k8s.io/examples/application/deployment-update.yaml`
> `kubectl scale --current-replicas=2 --replicas=3 deployment/nginx-deployment`

![](nginx-deployment-create.png)

然后我们使用下面的命令创建两个不同类型的`Service`：`ClusterIP`和`NodePort`，`NodePort`和`ClusterIP`不同的是，我们可以从集群外访问我们的服务：

> `kubectl expose deploy nginx-deployment --port=8080 --target-port=80 --type=ClusterIP --name=nginx-deploy-clusterip-svc`
> `kubectl expose deploy nginx-deployment --port=8081 --target-port=80 --type=NodePort --name=nginx-deploy-nodeport-svc`

![](nginx-service-create.png)

在创建`Service`的时候，如果带了选择符，还会创建一个`EndpointSlice`集合，这个集合指向的是选择符选中的`Pod`集合，例如：：

```
root@ctrlnode:/home/ubuntu# kubectl get ep
NAME                         ENDPOINTS                                   AGE
kubernetes                   192.168.67.8:6443                           25m
nginx-deploy-clusterip-svc   10.244.0.4:80,10.244.1.2:80,10.244.2.2:80   103s
nginx-deploy-nodeport-svc    10.244.0.4:80,10.244.1.2:80,10.244.2.2:80   7m24s
root@ctrlnode:/home/ubuntu#
```

然后使用如下的命令创建一个`Pod`并且进入容器内进行验证：

> `kubectl run mytools -it --rm --image=praqma/network-multitool --image-pull-policy=IfNotPresent --command -- /bin/bash`

![](mytools-create.png)

在这个`Pod`中，可以使用`curl` 命令访问我们的服务，分别是 `10.105.145.136:8080` 和 `10.102.231.147:8081`。

### DNS

`k8s`集群创建的时候会创建一个`kube-dns`服务，用于对`Service`进行域名解析，每个`Service`都会被被自动分配一个 `<svc>.<namespace>.svc.<cluster-domain>` 格式的域名，在每个`Pod`中，也会存在关于域名解析的配置：

![](pod-dns-config.png)

这个文件中配置了多个`search`域，所以当我们写`nginx-deploy-clusterip-svc`、或者`nginx-deploy-clusterip-svc.default`，或者`nginx-deploy-clusterip-svc.default.svc`都是可以解析的：

![](nslookup-nginx-svc.png)

`ndots:5` 指的是如果域名中的`.`大于等于`5`个，则不走`search`域，目的是减少常规域名的解析次数。

### ClusterIP

`ClusterIP`是`K8S`中最基础的服务，只能用于集群内访问。我们来看当我们从`mytools`这个`Pod`访问我们的`nginx-deploy-clusterip-svc`时，它是怎么样一个过程：

![](mytools-curl-clusterip-svc.png)

`mytools`被调度了`node2`上：

```
root@ctrlnode:/home/ubuntu# kubectl get pods -owide
NAME                                READY   STATUS    RESTARTS   AGE     IP           NODE       NOMINATED NODE   READINESS GATES
mytools                             1/1     Running   0          4m15s   10.244.2.3   node2      <none>           <none>
nginx-deployment-848dd6cfb5-c9cm6   1/1     Running   0          17m     10.244.1.2   node1      <none>           <none>
nginx-deployment-848dd6cfb5-h48dk   1/1     Running   0          17m     10.244.2.2   node2      <none>           <none>
nginx-deployment-848dd6cfb5-zbvj5   1/1     Running   0          17m     10.244.0.4   ctrlnode   <none>           <none>
root@ctrlnode:/home/ubuntu#
```

从容器中发出去的报文出现在主机上时，一看系统的路由，也不知道如何处理，没有处理 `10.109.146.68` 的路由信息：

```
root@node2:/home/ubuntu# route -n
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
0.0.0.0         192.168.67.1    0.0.0.0         UG    100    0        0 enp0s1
10.244.0.0      10.244.0.0      255.255.255.0   UG    0      0        0 flannel.1
10.244.1.0      10.244.1.0      255.255.255.0   UG    0      0        0 flannel.1
10.244.2.0      0.0.0.0         255.255.255.0   U     0      0        0 cni0
172.17.0.0      0.0.0.0         255.255.0.0     U     0      0        0 docker0
192.168.67.0    0.0.0.0         255.255.255.0   U     100    0        0 enp0s1
192.168.67.1    0.0.0.0         255.255.255.255 UH    100    0        0 enp0s1
```

所以就会流入默认网口`enp0s1`进行处理，按照我们对`iptables`的处理流程，这个包在处理之前会先触发`NF_INET_PRE_ROUTING`中的一系列钩子函数，对应于 `iptables` 中的 `PREROUTING` 链，而对于路由相关的信息都是在`nat`表中处理的，所以我们先来看下`nat`表中`PREROUTING`链的规则：

```shell
root@node2:/home/ubuntu# iptables -t nat -L PREROUTING | column -t
Chain          PREROUTING  (policy  ACCEPT)
target         prot        opt      source    destination
KUBE-SERVICES  all         --       anywhere  anywhere     /*        kubernetes  service   portals  */
DOCKER         all         --       anywhere  anywhere     ADDRTYPE  match       dst-type  LOCAL
root@node2:/home/ubuntu#
```

在`PREROUTING`找了`K8S`自定义的链`KUBE-SERVICES`，这个链中存储的是关于`Service`的一些规则：

```
root@node2:/home/ubuntu# iptables -t nat -L KUBE-SERVICES | column -t
Chain                      KUBE-SERVICES  (2   references)
target                     prot           opt  source       destination
KUBE-SVC-NPX46M4PTMTKRN6Y  tcp            --   anywhere     10.96.0.1       /*  default/kubernetes:https            cluster  IP          */     tcp   dpt:https
KUBE-SVC-TCOU7JCQXEZGVUNU  udp            --   anywhere     10.96.0.10      /*  kube-system/kube-dns:dns            cluster  IP          */     udp   dpt:domain
KUBE-SVC-ERIFXISQEP7F7OF4  tcp            --   anywhere     10.96.0.10      /*  kube-system/kube-dns:dns-tcp        cluster  IP          */     tcp   dpt:domain
KUBE-SVC-JD5MR3NA4I4DYORP  tcp            --   anywhere     10.96.0.10      /*  kube-system/kube-dns:metrics        cluster  IP          */     tcp   dpt:9153
KUBE-SVC-5KZKXYM2F4JEGSLN  tcp            --   anywhere     10.102.231.147  /*  default/nginx-deploy-nodeport-svc   cluster  IP          */     tcp   dpt:tproxy
KUBE-SVC-ATSXPZA6MCLBTOSW  tcp            --   anywhere     10.105.145.136  /*  default/nginx-deploy-clusterip-svc  cluster  IP          */     tcp   dpt:http-alt
KUBE-NODEPORTS             all            --   anywhere     anywhere        /*  kubernetes                          service  nodeports;  NOTE:  this  must          be  the  last  rule  in  this  chain  */  ADDRTYPE  match  dst-type  LOCAL
root@node2:/home/ubuntu#
```

然后对于目标地址为`10.105.145.136`的报文进入`KUBE-SVC-ATSXPZA6MCLBTOSW`处理，由于`nginx-deploy-clusterip-svc`有三个`pod`，所以做负载均衡，三个`POD`被访问的几率都是`1/3`：

```
root@node2:/home/ubuntu# iptables -t nat -L KUBE-SVC-ATSXPZA6MCLBTOSW | column -t
Chain                      KUBE-SVC-ATSXPZA6MCLBTOSW  (1   references)
target                     prot                       opt  source          destination
KUBE-MARK-MASQ             tcp                        --   !10.244.0.0/16  10.105.145.136  /*  default/nginx-deploy-clusterip-svc  cluster  IP             */  tcp        dpt:http-alt
KUBE-SEP-E4NSA7Z3P6FEYR22  all                        --   anywhere        anywhere        /*  default/nginx-deploy-clusterip-svc  ->       10.244.0.4:80  */  statistic  mode          random  probability  0.33333333349
KUBE-SEP-ENS4OGYPXWST7P2F  all                        --   anywhere        anywhere        /*  default/nginx-deploy-clusterip-svc  ->       10.244.1.2:80  */  statistic  mode          random  probability  0.50000000000
KUBE-SEP-T5LUV6MAWERK7MSM  all                        --   anywhere        anywhere        /*  default/nginx-deploy-clusterip-svc  ->       10.244.2.2:80  */
```

当匹配到某个`POD`时，进入到对应的 `KUBE-SEP-*`，然后通过`DNAT`转换，就把访问`Service`的请求转换到了具体的`Pod`中，而`Pod`在不同节点之间本来就是互通的，是有路由信息的：

```shell
root@node2:/home/ubuntu# iptables -t nat -L KUBE-SEP-E4NSA7Z3P6FEYR22 | column -t
Chain           KUBE-SEP-E4NSA7Z3P6FEYR22  (1   references)
target          prot                       opt  source       destination
KUBE-MARK-MASQ  all                        --   10.244.0.4   anywhere     /*  default/nginx-deploy-clusterip-svc  */
DNAT            tcp                        --   anywhere     anywhere     /*  default/nginx-deploy-clusterip-svc  */  tcp  to:10.244.0.4:80
root@node2:/home/ubuntu# iptables -t nat -L KUBE-SEP-ENS4OGYPXWST7P2F | column -t
Chain           KUBE-SEP-ENS4OGYPXWST7P2F  (1   references)
target          prot                       opt  source       destination
KUBE-MARK-MASQ  all                        --   10.244.1.2   anywhere     /*  default/nginx-deploy-clusterip-svc  */
DNAT            tcp                        --   anywhere     anywhere     /*  default/nginx-deploy-clusterip-svc  */  tcp  to:10.244.1.2:80
root@node2:/home/ubuntu# iptables -t nat -L KUBE-SEP-T5LUV6MAWERK7MSM | column -t
Chain           KUBE-SEP-T5LUV6MAWERK7MSM  (1   references)
target          prot                       opt  source       destination
KUBE-MARK-MASQ  all                        --   10.244.2.2   anywhere     /*  default/nginx-deploy-clusterip-svc  */
DNAT            tcp                        --   anywhere     anywhere     /*  default/nginx-deploy-clusterip-svc  */  tcp  to:10.244.2.2:80
root@node2:/home/ubuntu#
```

根据`node2`节点上的路由信息，会把发往`10.244.0.4/16`、`10.244.1.2/16` 网络的报文通过 `flannel.1` 发出去，而发往 `10.244.2.2/16` 的报文由于在本机上，所以通过 `cni0` 网口就可以处理。这部分不懂的可以看[容器网络 - 跨主机容器通信](/2023/12/12/Network/container-network-cross-host/)以及[Kubernetes CNI 网络](/2023/12/29/K8S/k8s-cni-network/)。

在`node2`上的`iptables`规则中还能找到很多`KUBE-MARK-MASQ`相关的规则，这个链中的规则是用于做`SNAT`转换的，它的流程是这样的，在`PREROUTING`阶段使用`Mark`这个`Target`给要`SNAT`的包打上标记，在`POSTROUTING`阶段使用`MASQUERADE`做`SNAT`转换，`MASQUERADE`和`SNAT`这两个`iptables`的`Target`区别是，`SNAT`需要指定的具体的原地址，而`MASQUERADE`会动态获取报文发出去的网卡上的`IP`作为原地址。例如，当我们访问`10.105.145.136`的报文最终被路由到了`node1`，那么在从`node2`上的`enp0s1`网卡发送出去时，通过`MASQUERADE`将报文的原地址设置成`node2`上`enp0s1`网卡的地址。

```shell
root@node2:/home/ubuntu# iptables -t nat -L KUBE-MARK-MASQ | column -t
Chain   KUBE-MARK-MASQ  (20  references)
target  prot            opt  source       destination
MARK    all             --   anywhere     anywhere     MARK  or  0x4000
root@node2:/home/ubuntu#
root@node2:/home/ubuntu# iptables -t nat -L KUBE-POSTROUTING | column -t
Chain       KUBE-POSTROUTING  (1   references)
target      prot              opt  source       destination
RETURN      all               --   anywhere     anywhere     mark  match       !        0x4000/0x4000
MARK        all               --   anywhere     anywhere     MARK  xor         0x4000
MASQUERADE  all               --   anywhere     anywhere     /*    kubernetes  service  traffic        requiring  SNAT  */  random-fully
root@node2:/home/ubuntu#
```

关于`MASQUERADE`的介绍可以看[这里](https://manpages.ubuntu.com/manpages/xenial/man8/iptables-extensions.8.html#target%20extensions)。

 ### NodePort

`ClusterIP`类型的服务只能在集群内访问，如果要在集群外访问我们的服务，最简单是创建一个对于`NodePort`类型的`Service`，这样我们就可以通过每个节点的“公网”`IP`进行访问，例如控制节点的`IP`是`192.168.67.8`，那么我们可以通过`192.168.67.8:30673`访问我们的服务：

![](ctrlnode-nodeport-svc.png)

通过浏览器进行访问：

![](browser-visit-nodeport-svc.png)

同理，我们先到处 `nat` 表中的 `PREROUTING` 链中的所有规则：

```
root@ctrlnode:/home/ubuntu# iptables -t nat -L PREROUTING | column -t
Chain          PREROUTING  (policy  ACCEPT)
target         prot        opt      source    destination
KUBE-SERVICES  all         --       anywhere  anywhere     /*        kubernetes  service   portals  */
DOCKER         all         --       anywhere  anywhere     ADDRTYPE  match       dst-type  LOCAL
root@ctrlnode:/home/ubuntu#
```

然后会在`KUBE-SERVICES`链中最后一条是和`NodePort`相关的规则，访问本地服务的链进入到`KUBE-NODEPORTS`链中的规则进行处理：

```
root@ctrlnode:/home/ubuntu# iptables -t nat -L KUBE-SERVICES | column -t
Chain                      KUBE-SERVICES  (2   references)
target                     prot           opt  source       destination
...
KUBE-NODEPORTS             all            --   anywhere     anywhere        /*  kubernetes                          service  nodeports;  NOTE:  this  must          be  the  last  rule  in  this  chain  */  ADDRTYPE  match  dst-type  LOCAL
```

`NodePort`链中的规则如下，只是简单跳转到了对应的`NodePort`服务的链中，对于{% label primary@30673 %}端口的访问进入到了`KUBE-EXT-5KZKXYM2F4JEGSLN`链中：

```
root@ctrlnode:/home/ubuntu# iptables -t nat -L KUBE-NODEPORTS | column -t
Chain                      KUBE-NODEPORTS  (1   references)
target                     prot            opt  source       destination
KUBE-EXT-5KZKXYM2F4JEGSLN  tcp             --   anywhere     anywhere     /*  default/nginx-deploy-nodeport-svc  */  tcp  dpt:30673
```

然后就是跳转到了对应的`Service`链中：

```
root@ctrlnode:/home/ubuntu# iptables -t nat -L KUBE-EXT-5KZKXYM2F4JEGSLN | column -t
Chain                      KUBE-EXT-5KZKXYM2F4JEGSLN  (1   references)
target                     prot                       opt  source       destination
KUBE-MARK-MASQ             all                        --   anywhere     anywhere     /*  masquerade  traffic  for  default/nginx-deploy-nodeport-svc  external  destinations  */
KUBE-SVC-5KZKXYM2F4JEGSLN  all                        --   anywhere     anywhere
```

到此就和`ClusterIP`类型的服务一样了：

```
root@ctrlnode:/home/ubuntu# iptables -t nat -L KUBE-SVC-5KZKXYM2F4JEGSLN | column -t
Chain                      KUBE-SVC-5KZKXYM2F4JEGSLN  (2   references)
target                     prot                       opt  source          destination
KUBE-MARK-MASQ             tcp                        --   !10.244.0.0/16  10.102.231.147  /*  default/nginx-deploy-nodeport-svc  cluster  IP             */  tcp        dpt:tproxy
KUBE-SEP-MVLCWZHJ2N4KWRDM  all                        --   anywhere        anywhere        /*  default/nginx-deploy-nodeport-svc  ->       10.244.0.4:80  */  statistic  mode        random  probability  0.33333333349
KUBE-SEP-67BWTVMW4OYVG527  all                        --   anywhere        anywhere        /*  default/nginx-deploy-nodeport-svc  ->       10.244.1.2:80  */  statistic  mode        random  probability  0.50000000000
KUBE-SEP-NVYXSNHSAWUISCCT  all                        --   anywhere        anywhere        /*  default/nginx-deploy-nodeport-svc  ->       10.244.2.2:80  */
root@ctrlnode:/home/ubuntu#
```

### LoadBalancer

`ClusterIP`类型的`Service`在`Pod`间实现了负载均衡，`NodePort`提供了通过每个节点的公网IP访问集群服务的可能性，但是又带来了一个新的问题，这些服务没法在节点之间进行负载均衡，所以就出现了叫做`LoadBalancer`类型的服务，对`NodePort`类型的服务进行负载均衡，我们可以使用如下的命令创建一个该类型的服务：

> `kubectl expose deploy nginx-deployment --port=8082 --target-port=80 --type=LoadBalancer --name=nginx-deploy-lb-svc`

但是这个时候查看新建的服务`nginx-deploy-lb-svc`，它的`EXTERNAL-IP`显示`<pengding>`，是因为集群中还没有一个`LoadBalancer`提供服务：

![](lb-service-pending.png)

安装[METALLB](https://metallb.universe.tf/)作为`LoadBalancer`：

> `kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.14.3/config/manifests/metallb-native.yaml`

然后使用如下命令为`METALLB`生成配置，下面的配置让它工作在二层协议，为其分配的地址和我们三个节点处在相同的网段，关于它更多的原理可以看[这里](https://atbug.com/load-balancer-service-with-metallb/)：

```
kubectl apply -f - <<EOF
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: mylocal-net-pool
  namespace: metallb-system
spec:
  addresses:
  - 192.168.67.240-192.168.67.250
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: example
  namespace: metallb-system
spec:
  ipAddressPools:
  - mylocal-net-pool
EOF
```

`192.168.67.240-192.168.67.250` 要和节点的公网`IP`处于同一个地址段，查看`Service`，它的`EXTERNAL-IP`已经被分配成了`192.168.67.240`：

![](lb-service-ip-allocate.png)

此时如果访问`http://192.168.67.240:8082/`是可以访问通的，因为`LoadBlancer`服务将这个`IP`地址的`MAC`信息通过`ARP`协议添加到了我们的`Host`上，而且这个地址对应的`MAC`信息和我们`ctrlnode`的公网`IP`的`MAC`地址完全一样，所以当从`Host`或者集群中的其他节点上进行访问的时候其实直接到了我们的`ctrlnode`进行处理：

{% grouppicture 2-2 %}
![](lb-service-mac-same.png)
![](lb-service-ctrlnode-mac.png)
{% endgrouppicture %}

依然来看当这个请求到达了`ctrlnode`上的时候，它是如何被处理的。毫无疑问，它肯定会从`nat`表中的`KUBE-SERVICES`进入然后被处理：

![](lb-service-kubeservice-chain.png)

可以看到的是，`LoadBlancer`类型的服务既可以从集群内部通过`ClusterIP`访问，也可以从外部通过`ExternalIP`进行访问，当通过`192.168.67.240`这个`IP`进行访问的时候，这个请求下一步会进入到`KUBE-EXT-BKP5P6G6IWL6KD3D`这个链中进行处理：

![](lb-service-ext-chain.png)

然后就开始在我们三个节点之间进行路由，和`ClusterIP`的处理方式一样了。

### 无头服务

按照[官方文档](https://kubernetes.io/zh-cn/docs/concepts/services-networking/service/#headless-services)描述的，`Headless Service` 好像没什么用，无头服务本质上`ClusterIP`类型的，只是他的`ClusterIP`是`None`，所以它没有集群`IP`，因此`kube-proxy`是不会处理这里服务的。从类型上分，无头服务分为有选择符的和没有选择符的。

#### 带有选择符

对于有选择符的无头服务，`K8S`还是会创建对应的`EndpointSlice`对象，并且修改`DNS`记录，在查询对应的服务名称时，直接返回后端的`EndpointSlice`中的`IP`地址，而不是`Service`的`ClusterIP`。举个例子，我们有如下所示的`Pod`：

```
root@ctrlnode:/home/ubuntu# kubectl get pods -l app=nginx -owide
NAME                                READY   STATUS    RESTARTS   AGE   IP           NODE       NOMINATED NODE   READINESS GATES
nginx-deployment-848dd6cfb5-c9cm6   1/1     Running   0          47h   10.244.1.2   node1      <none>           <none>
nginx-deployment-848dd6cfb5-h48dk   1/1     Running   0          47h   10.244.2.2   node2      <none>           <none>
nginx-deployment-848dd6cfb5-zbvj5   1/1     Running   0          47h   10.244.0.4   ctrlnode   <none>           <none>
```

我们使用如下的方式创建一个带选择符的无头服务：

> `kubectl expose deploy nginx-deployment --target-port=80 --type=ClusterIP  --cluster-ip=None --name=nginx-deploy-headless-svc`

查看该服务详情，它的`EndpointSlice`集合中存在对应的`Pod`地址：

```
root@ctrlnode:/home/ubuntu# kubectl describe svc/nginx-deploy-headless-svc
Name:              nginx-deploy-headless-svc
Namespace:         default
Labels:            <none>
Annotations:       <none>
Selector:          app=nginx
Type:              ClusterIP
IP Family Policy:  SingleStack
IP Families:       IPv4
IP:                None
IPs:               None
Port:              <unset>  80/TCP
TargetPort:        80/TCP
Endpoints:         10.244.0.4:80,10.244.1.2:80,10.244.2.2:80
Session Affinity:  None
Events:            <none>
```

如果此时使用`DNS`解析`nginx-deploy-headless-svc`，它返回的也是三个`Pod`的地址，使用`nginx-deploy-headless-svc`访问服务，就如同使用`Pod`的`IP`地址直接访问一样，不会通过`iptables`进行负载均衡：

```
bash-5.1# nslookup nginx-deploy-headless-svc
Server:		10.96.0.10
Address:	10.96.0.10#53

Name:	nginx-deploy-headless-svc.default.svc.cluster.local
Address: 10.244.0.4
Name:	nginx-deploy-headless-svc.default.svc.cluster.local
Address: 10.244.1.2
Name:	nginx-deploy-headless-svc.default.svc.cluster.local
Address: 10.244.2.2
```

#### 没有选择符

对于没有选择服务的无头服务，常用于去访问外部服务，因为它没有选择符，所以不会自动创建`EndpointSlice`集合，需要手动创建，否则它没有实际的意义。假如我们现在像访问集群外部的服务，又不想在代码中硬编码该服务的地址，就可以创建一个没有选择符的无头服务，然后手动创建该服务指向的`IP`地址，在代码中使用服务名称进行访问。

例如，我们在主机上通过`docker`启动一个`whoami`服务：

> `docker run -d -P --name whoami traefik/whoami`

启动之后可以通过下面的命令得到它在主机上发布的端口:

```
$ docker inspect --format '{{json .NetworkSettings.Ports }}'  whoami
{"80/tcp":[{"HostIp":"0.0.0.0","HostPort":"32768"}]}
```

现在我们使用下面的命令在`k8s`集群中创建一个名叫`whoami`的无头服务，以及一个同名的`EndpointSlice`集合，这里要注意的是，对于没有选择符的无头服务，它的`port`和`targetPort`必须相同，`172.31.205.142` 是我这个服务所在的公网地址：

```
kubectl apply -f - <<EOF
apiVersion: v1
kind: Endpoints
metadata:
  name: whoami
subsets:
  - addresses:
      - ip: 172.31.205.142
    ports:
      - port: 32768
---
apiVersion: v1
kind: Service
metadata:
  name: whoami
spec:
  clusterIP: None
  type: ClusterIP
  ports:
  - port: 32768
    targetPort: 32768
EOF
```

创建成功之后，我们就可以在`k8s`集群中实现通过名称放我们的`whoami`服务了：

```
bash-5.1# curl whoami:32768
Hostname: 4c3d750bd70c
IP: 127.0.0.1
IP: 172.17.0.2
RemoteAddr: 172.17.0.1:22447
GET / HTTP/1.1
Host: whoami:32768
User-Agent: curl/7.79.1
Accept: */*

bash-5.1# nslookup whoami
Server:         10.43.0.10
Address:        10.43.0.10#53

Name:   whoami.default.svc.cluster.local
Address: 172.31.205.142
```

### ExternalName

如果外部服务是通过`IP`访问的，我们可以使用不带选择符的无头服务在集群内配置名称进行访问。如果外部服务是以域名进行访问的，我们就可以创建`ExternalName`类型的`Service`仅进行访问外部服务。`ExternalName`本质上是在`k8s`集群内部的`DNS`中添加一条`CNAME`解析记录，`CNAME`可以把它看作是域名到域名的映射。

例如，对于我的博客，它的域名是`blog.fudenglong.site`，它本质上也是一个`CNAME`解析，它的值是`gamelife1314.github.io`，使用`dig`命令查询能得到下面的解析记录：

```
bash-5.1# dig blog.fudenglong.site
...
;; ANSWER SECTION:
blog.fudenglong.site.   5       IN      CNAME   gamelife1314.github.io.
gamelife1314.github.io. 5       IN      A       185.199.111.153
...
```

现在我们在集群内部创建一个`myblog`服务，指向`blog.fudenglong.site`：

```
kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: myblog
spec:
  type: ExternalName
  externalName: blog.fudenglong.site
EOF
```

然后使用 `dig` 命令在集群内部查询，可以看到`myblog`解析到了`blog.fudenglong.site`：

```
bash-5.1# dig +showsearch myblog
....
;; ANSWER SECTION:
myblog.default.svc.cluster.local. 5 IN  CNAME   blog.fudenglong.site.
blog.fudenglong.site.   5       IN      CNAME   gamelife1314.github.io.
gamelife1314.github.io. 5       IN      A       185.199.111.153
...
```

### Ingress

`Loadbalancer`类型的服务为每个`Service`都创建了一个负载均衡服务，这种做法成本高，实现麻烦，作为普通用户，应该更应该希望k8s能提供像nginx这样的反向代理功能，基于不同的`Host`，或者`url`规则，把请求转发到不同的后端服务中去，[Ingress](https://kubernetes.io/zh-cn/docs/reference/kubernetes-api/service-resources/ingress-v1/#Ingress) 就是用来提供这样的服务，可以把它看做是`Service`的`Service`，因为一个`Ingress`的后端对象是`Service`，不像`Service`，它的后端是`Pod`。

为了演示，除了本篇开始创建的`nginx-deploy-clusterip-svc`，再创建一个`Service`，使用如下的命令：

> kubectl create deployment whoami --image=traefik/whoami -r 3 --port=80
> kubectl expose deployment whoami --port=8080 --target-port=80 --type=ClusterIP --name=whoami

创建成功之后，使用如下的命令查看已创建的`whoami`：

```
root@ctrlnode:/home/ubuntu# kubectl describe svc whoami
Name:              whoami
Namespace:         default
Labels:            app=whoami
Annotations:       <none>
Selector:          app=whoami
Type:              ClusterIP
IP Family Policy:  SingleStack
IP Families:       IPv4
IP:                10.108.154.253
IPs:               10.108.154.253
Port:              <unset>  8080/TCP
TargetPort:        80/TCP
Endpoints:         10.244.0.5:80,10.244.1.5:80,10.244.2.4:80
Session Affinity:  None
Events:            <none>
```

接下来，创建一个`Ingress`，需要注意的`Ingress`和`Service`必须在相同的命名空间内，默认是`default`：

```
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: default-ingress
spec:
  ingressClassName: nginx
  rules:
  - host: "nginx.svc.local"
    http:
      paths:
      - pathType: Prefix
        path: "/"
        backend:
          service:
            name: nginx-deploy-clusterip-svc
            port:
              number: 8080
  - host: "whoami.svc.local"
    http:
      paths:
      - pathType: Prefix
        path: "/"
        backend:
          service:
            name: whoami
            port:
              number: 8080
EOF
```

上面的`ingressClassName`指得是这个`Ingress`使用哪个`IngressController`，因为`Ingress`对象只是一份描述文件，它并没有实际的意义，需要`IngressController`对它解释并提供服务，而`IngressController`需要额外安装的，这里使用[NginxIngress](https://kubernetes.github.io/ingress-nginx/deploy/#quick-start)，安装如下所示：

> `kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml`

```
root@ctrlnode:/home/ubuntu# kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
namespace/ingress-nginx created
serviceaccount/ingress-nginx created
serviceaccount/ingress-nginx-admission created
role.rbac.authorization.k8s.io/ingress-nginx created
role.rbac.authorization.k8s.io/ingress-nginx-admission created
clusterrole.rbac.authorization.k8s.io/ingress-nginx created
clusterrole.rbac.authorization.k8s.io/ingress-nginx-admission created
rolebinding.rbac.authorization.k8s.io/ingress-nginx created
rolebinding.rbac.authorization.k8s.io/ingress-nginx-admission created
clusterrolebinding.rbac.authorization.k8s.io/ingress-nginx created
clusterrolebinding.rbac.authorization.k8s.io/ingress-nginx-admission created
configmap/ingress-nginx-controller created
service/ingress-nginx-controller created
service/ingress-nginx-controller-admission created
deployment.apps/ingress-nginx-controller created
job.batch/ingress-nginx-admission-create created
job.batch/ingress-nginx-admission-patch created
ingressclass.networking.k8s.io/nginx created
validatingwebhookconfiguration.admissionregistration.k8s.io/ingress-nginx-admission created
root@ctrlnode:/home/ubuntu#
```

等一切就绪的时候，去查看创建的`default-ingress`，它已经被分配了从集群外访问的外部地址`192.168.67.241`：

![](defualt-ingress.png)

现在，就可以使用我们自定义的域名访问服务了，只是要把自定义的域名解析到`192.168.67.241`，例如：

> curl --resolve nginx.svc.local:80:192.168.67.241 http://nginx.svc.local/
> curl --resolve whoami.svc.local:80:192.168.67.241 http://whoami.svc.local/

![](curl-ingress-svc.png)

那这个`192.168.67.241`到底是谁分配的呢？在安装`NginxIngress`的时候，它其实还创建了一个`LoadBalancer`类型的`service/ingress-nginx-controller`，所以这个IP地址是我们集群内安装的负载均衡服务分配的，它就成了集群中`NginxIngress`的入口：

![](ingress-nginx-svc.png)

到这里这个流程现在变得清楚了，通过`192.168.67.241`这个外部`IP`到达我们集群中之后，流程首先到`ingress-nginx-controller`这个`Pod`：

```
root@ctrlnode:/home/ubuntu# kubectl get pods -n ingress-nginx -owide
NAME                                        READY   STATUS      RESTARTS   AGE    IP           NODE    NOMINATED NODE   READINESS GATES
ingress-nginx-admission-create-dxbwq        0/1     Completed   0          119m   10.244.1.6   node1   <none>           <none>
ingress-nginx-admission-patch-7hsfx         0/1     Completed   2          119m   10.244.2.5   node2   <none>           <none>
ingress-nginx-controller-8558859656-bwkj7   1/1     Running     0          119m   10.244.2.6   node2   <none>           <none>
```

这个`Pod`会将对`Ingress`对象的描述翻译成它能理解的`/etc/nginx/nginx.conf`：

![](nginx-ingress-controller-conf.png)

然后内部再将流量路由到`nginx-deploy-clusterip-svc`和`whoami`，整个过程如下图所示：

![](nginx-ingress-arch.png)


### 参考链接

1. [Understanding networking in Kubernetes](https://learncloudnative.com/blog/2023-05-31-kubeproxy-iptables)
2. [Kubernetes Services and Iptables](https://msazure.club/kubernetes-services-and-iptables/)
3. [kubernetes - 虚拟IP和服务代理](https://kubernetes.io/zh-cn/docs/reference/networking/virtual-ips/)
4. [Kubernetes Service iptables 网络通信验证](https://lotabout.me/2022/Kubernetes-Service-Model-Verification/)
5. [服务发现与负载均衡](https://jimmysong.io/kubernetes-handbook/practice/service-discovery-and-loadbalancing.html)
6. [Kubernetes LoadBalancer Service 与负载均衡器](https://atbug.com/k8s-service-and-load-balancer/)
7. [在 Kubernetes 集群中使用 MetalLB 作为 LoadBalancer（下）- BGP](https://atbug.com/load-balancer-service-with-metallb-bgp-mode/)
8. [MetalLB服务和BGP路由器测试](https://www.flftuu.com/2023/06/08/MetalLB%E6%9C%8D%E5%8A%A1%E5%92%8CBGP%E8%B7%AF%E7%94%B1%E5%99%A8%E6%B5%8B%E8%AF%95/)