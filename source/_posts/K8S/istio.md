---
title: Istio 实践笔记
date: 2024-03-04 17:14:00
tags:
    - istio
categories:
    - k8s
---


`Istio` 是服务网格，即`ServiceMesh`的一种实现，服务网格通常用于描述构成应用程序的网络以及它们之间的交互。在从单体应用向分布式微服务架构转型的过程中，虽然从中获益良多，但是随着规模和复杂性的增长，服务网格越来越难以理解，给开发人员和运维人员带来的挑战快速增加。这些挑战包括：服务发现，负载均衡，故障恢复，指标收集，监控以及一些更加复杂的运维需求，例如：`A/B测试`、金丝雀发布、限流、访问控制，端到端认证等。而 `Istio` 提供了一个完整的解决方案，通过为整个服务网格提供行为洞察和操作控制来满足微服务应用程序的多样化需求。

`Istio` 以非常简单的方式来为已部署的服务建立网络，对应用程序代码只需要进行一点或者不需要做任何改动，要想让服务支持`Istio`，只需要在应用旁边部署一个 `sidecar` 代理，使用 `Istio` 的控制面进行功能配置和管理代理，拦截服务之间的所有网络通信，已达到：

- `HTTP`、`gRPC`、`WebSocket` 和 `TCP` 流量的自动负载均衡；
- 通过丰富的路由规则、重试、故障转移和故障注入，可以对流量行为进行细粒度控制；
- 可插入的策略层和配置 API，支持访问控制、速率限制和配额；
- 对出入集群入口和出口中所有流量的自动度量指标、日志记录和追踪；
- 通过强大的基于身份的验证和授权，在集群中实现安全的服务间通信；

综上，对 `Istio` 的核心功能可以总结为以下几点：

1. 流量管理，通过简单的规则配置和流量路由，可以控制服务之间的流量和`API`调用。`Istio` 简化了断路器、超时和重试等服务级别属性的配置，并且可以轻松设置`A/B`测试、金丝雀部署和基于百分比的流量分割的分阶段部署等重要任务；
2. 安全，`Istio` 的安全功能使开发人员可以专注于应用程序级别的安全性。`Istio` 提供底层安全通信信道，并大规模管理服务通信的认证、授权和加密。使用`Istio`，服务通信在默认情况下是安全的，它允许您跨多种协议和运行时一致地实施策略——所有这些都很少或根本不需要应用程序更改；
3. 可观察性，`Istio` 强大的追踪、监控和日志记录可让开发或者运维人员深入了解服务网格部署。通过 `Istio` 的监控功能，可以真正了解服务性能如何影响上游和下游的功能，而其自定义仪表板可以提供对所有服务性能的可视性；

在架构上，Istio 服务网格逻辑上分为数据平面和控制平面，其中：

- 数据平面由一组以 `sidecar` 方式部署的智能代理（[Envoy](https://www.envoyproxy.io/)）组成。这些代理负责协调和控制微服务之间的所有网络通信。 它们还收集和报告所有网格流量的遥测数据；
- 控制平面 管理并配置代理来进行流量路由；

架构图如下图所示：

![](https://istio.io/latest/zh/docs/ops/deployment/architecture/arch.svg)

`Envoy`：是用 `C++` 开发的高性能代理，用于协调服务网格中所有服务的入站和出站流量。`Envoy` 代理是唯一与数据平面流量交互的 `Istio` 组件。`Envoy` 被部署为服务的 `Sidecar`，在逻辑上为服务增加了 `Envoy` 的许多内置特性，例如：动态服务发现，负载均衡，`TLS` 终端，`HTTP/2` 与 `gRPC` 代理，熔断器，健康检查，基于百分比流量分割的分阶段发布，故障注入，丰富的指标；

`Sidecar` 代理模型还允许您向现有的部署添加 `Istio` 功能，而不需要重新设计架构或重写代码。由 Envoy 代理启用的一些 Istio 的功能和任务包括：

- 流量控制功能：通过丰富的 `HTTP`、`gRPC`、`WebSocket` 和 `TCP` 流量路由规则来执行细粒度的流量控制；
- 网络弹性特性：重试设置、故障转移、熔断器和故障注入；
- 安全性和身份认证特性：执行安全性策略，并强制实行通过配置 `API` 定义的访问控制和速率限制；
- 基于 `WebAssembly` 的可插拔扩展模型，允许通过自定义策略执行和生成网格流量的遥测；

`Istiod` 将控制流量行为的高级路由规则转换为 `Envoy` 特定的配置， 并在运行时将其传播给 `Sidecar`。`Pilot` 提取了特定平台的服务发现机制，并将其综合为一种标准格式，任何符合 `Envoy API` 的 `Sidecar` 都可以使用。以及通过内置的身份和凭证管理，实现了强大的服务对服务和终端用户认证，可以使用 `Istio` 来升级服务网格中未加密的流量，这样运营商可以基于服务身份而不是相对不稳定的第`3`层或第`4`层网络标识符来执行策略。`Istiod` 还可以充当证书授权（`CA`），生成证书以允许在数据平面中进行安全的 `mTLS` 通信。

<!-- more -->

### 安装

本节使用 `istioctl` 安装 `istio`，可以从[发布页面](https://github.com/istio/istio/releases)下载预编译的版本，在安装的时候根据需要选择不同的[配置](https://istio.io/latest/zh/docs/setup/additional-setup/config-profiles/)，这里为了后续的演示和示例，选择 `demo` 配置项，这将会安装 `istio-ingressgateway`、`istio-egressgateway` 和 `istiod`：

> `istioctl install --set profile=demo`

```
$ ./bin/istioctl install --set profile=demo
This will install the Istio 1.20.3 "demo" profile (with components: Istio core, Istiod, Ingress gateways, and Egress gateways) into the cluster. Proceed? (y/N) y
✔ Istio core installed
✔ Istiod installed
✔ Ingress gateways installed
✔ Egress gateways installed
✔ Installation complete
Made this installation the default for injection and validation.
```

可以通过下面的命令查看安装到集群中的 `istio` 的配置：

> `kubectl -n istio-system get IstioOperator installed-state -o yaml`

可以通过下面的命令验证在集群中安装的资源信息：

> `./bin/istioctl verify-install --revision default`

```
$ ./bin/istioctl verify-install --revision default
✔ ServiceAccount: istio-reader-service-account.istio-system checked successfully
✔ CustomResourceDefinition: wasmplugins.extensions.istio.io.istio-system checked successfully
✔ CustomResourceDefinition: destinationrules.networking.istio.io.istio-system checked successfully
✔ CustomResourceDefinition: envoyfilters.networking.istio.io.istio-system checked successfully
✔ CustomResourceDefinition: gateways.networking.istio.io.istio-system checked successfully
✔ CustomResourceDefinition: proxyconfigs.networking.istio.io.istio-system checked successfully
✔ CustomResourceDefinition: serviceentries.networking.istio.io.istio-system checked successfully
✔ CustomResourceDefinition: sidecars.networking.istio.io.istio-system checked successfully
✔ CustomResourceDefinition: virtualservices.networking.istio.io.istio-system checked successfully
✔ CustomResourceDefinition: workloadentries.networking.istio.io.istio-system checked successfully
✔ CustomResourceDefinition: workloadgroups.networking.istio.io.istio-system checked successfully
✔ CustomResourceDefinition: authorizationpolicies.security.istio.io.istio-system checked successfully
✔ CustomResourceDefinition: peerauthentications.security.istio.io.istio-system checked successfully
✔ CustomResourceDefinition: requestauthentications.security.istio.io.istio-system checked successfully
✔ CustomResourceDefinition: telemetries.telemetry.istio.io.istio-system checked successfully
✔ CustomResourceDefinition: istiooperators.install.istio.io.istio-system checked successfully
✔ ClusterRole: istiod-clusterrole-istio-system.istio-system checked successfully
✔ ClusterRole: istiod-gateway-controller-istio-system.istio-system checked successfully
✔ ClusterRoleBinding: istiod-clusterrole-istio-system.istio-system checked successfully
✔ ClusterRoleBinding: istiod-gateway-controller-istio-system.istio-system checked successfully
✔ ConfigMap: istio.istio-system checked successfully
✔ Deployment: istiod.istio-system checked successfully
✔ ConfigMap: istio-sidecar-injector.istio-system checked successfully
✔ MutatingWebhookConfiguration: istio-sidecar-injector.istio-system checked successfully
✔ PodDisruptionBudget: istiod.istio-system checked successfully
✔ ClusterRole: istio-reader-clusterrole-istio-system.istio-system checked successfully
✔ ClusterRoleBinding: istio-reader-clusterrole-istio-system.istio-system checked successfully
✔ Role: istiod.istio-system checked successfully
✔ RoleBinding: istiod.istio-system checked successfully
✔ Service: istiod.istio-system checked successfully
✔ ServiceAccount: istiod.istio-system checked successfully
✔ ValidatingWebhookConfiguration: istio-validator-istio-system.istio-system checked successfully
✔ Deployment: istio-ingressgateway.istio-system checked successfully
✔ PodDisruptionBudget: istio-ingressgateway.istio-system checked successfully
✔ Role: istio-ingressgateway-sds.istio-system checked successfully
✔ RoleBinding: istio-ingressgateway-sds.istio-system checked successfully
✔ Service: istio-ingressgateway.istio-system checked successfully
✔ ServiceAccount: istio-ingressgateway-service-account.istio-system checked successfully
✔ Deployment: istio-egressgateway.istio-system checked successfully
✔ PodDisruptionBudget: istio-egressgateway.istio-system checked successfully
✔ Role: istio-egressgateway-sds.istio-system checked successfully
✔ RoleBinding: istio-egressgateway-sds.istio-system checked successfully
✔ Service: istio-egressgateway.istio-system checked successfully
✔ ServiceAccount: istio-egressgateway-service-account.istio-system checked successfully
Checked 15 custom resource definitions
Checked 3 Istio Deployments
✔ Istio is installed and verified successfully
```

查看安装的 `Pod`、`SVC` 以及 `Deploy` 这些关键资源：

> `kubectl get svc,pod,deploy -n istio-system -owide`

```
$ kubectl get svc,pod,deploy -n istio-system -owide
NAME                           TYPE           CLUSTER-IP      EXTERNAL-IP      PORT(S)                                                                      AGE     SELECTOR
service/istiod                 ClusterIP      10.43.68.92     <none>           15010/TCP,15012/TCP,443/TCP,15014/TCP                                        9m35s   app=istiod,istio=pilot
service/istio-egressgateway    ClusterIP      10.43.78.245    <none>           80/TCP,443/TCP                                                               9m33s   app=istio-egressgateway,istio=egressgateway
service/istio-ingressgateway   LoadBalancer   10.43.114.120   172.19.106.241   15021:32695/TCP,80:31783/TCP,443:30165/TCP,31400:32067/TCP,15443:31202/TCP   9m33s   app=istio-ingressgateway,istio=ingressgateway

NAME                                        READY   STATUS    RESTARTS   AGE     IP           NODE           NOMINATED NODE   READINESS GATES
pod/istiod-75d8d56b68-tr97k                 1/1     Running   0          9m35s   10.42.0.10   ctrlnode       <none>           <none>
pod/istio-ingressgateway-86446666f9-qn4f2   1/1     Running   0          9m33s   10.42.0.12   ctrlnode       <none>           <none>
pod/istio-egressgateway-c878fd6c5-4m6ds     1/1     Running   0          9m33s   10.42.0.11   ctrlnode       <none>           <none>

NAME                                   READY   UP-TO-DATE   AVAILABLE   AGE     CONTAINERS    IMAGES                           SELECTOR
deployment.apps/istiod                 1/1     1            1           9m35s   discovery     docker.io/istio/pilot:1.20.3     istio=pilot
deployment.apps/istio-ingressgateway   1/1     1            1           9m33s   istio-proxy   docker.io/istio/proxyv2:1.20.3   app=istio-ingressgateway,istio=ingressgateway
deployment.apps/istio-egressgateway    1/1     1            1           9m33s   istio-proxy   docker.io/istio/proxyv2:1.20.3   app=istio-egressgateway,istio=egressgateway
```

### 功能介绍

接下来使用 `istio` 发布件中的 `bookinfo` 应用来演示 `istio` 的各项功能，首先是安装该应用，使用如下的步骤进行安装，：

```
$ kubectl create ns bookinfo-test
namespace/bookinfo-test created
$ kubectl label namespace bookinfo-test istio-injection=enabled
$ kubectl apply -n bookinfo-test -f samples/bookinfo/platform/kube/bookinfo.yaml
service/details created
serviceaccount/bookinfo-details created
deployment.apps/details-v1 created
service/ratings created
serviceaccount/bookinfo-ratings created
deployment.apps/ratings-v1 created
service/reviews created
serviceaccount/bookinfo-reviews created
deployment.apps/reviews-v1 created
deployment.apps/reviews-v2 created
deployment.apps/reviews-v3 created
service/productpage created
serviceaccount/bookinfo-productpage created
deployment.apps/productpage-v1 created
```

上面最重要的流程是给 `bookinfo-test` 命名空间添加了 `istio-injection=enabled` 标签，这样 `istio` 会为这个命名空间中的 `pod` 自动注入 `istio-proxy` 这个 `Sidecar` 容器。

#### 创建网关

这里有多种方式作为入口流量的网关，可以使用 `Istio Gateway`、`K8S Gateway` 以及 `K8S Ingress`，要注意的是 `Istio Gateway` 和 `K8S Gateway` 虽然资源名称是一样的，都叫 `Gateway`，但是它们在使用方式是完全不一样的，下面的示例中以 `Istio Gateway` 为示例进行。创建用于 `bookinfo` 应用的网关使用如下的命令：

> `kubectl apply -n bookinfo-test -f samples/bookinfo/networking/bookinfo-gateway.yaml`

该 `yaml` 文件中的内容如下：

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: Gateway
metadata:
  name: bookinfo-gateway
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 8080
      name: http
      protocol: HTTP
    hosts:
    - "*"
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: bookinfo
spec:
  hosts:
  - "*"
  gateways:
  - bookinfo-gateway
  http:
  - match:
    - uri:
        exact: /productpage
    - uri:
        prefix: /static
    - uri:
        exact: /login
    - uri:
        exact: /logout
    - uri:
        prefix: /api/v1/products
    route:
    - destination:
        host: productpage
        port:
          number: 9080
```

上面的 `yaml` 中，`Gateway` 的 `API` 版本是 `networking.istio.io/v1alpha3`，这和 `K8S Gateway` 是完全不一样的，所以他们是两个完全不一样的资源。`Gateway` 中的 `spec.selector` 使用选择使用哪个 `Pod` 来处理该网关的请求，这里选择的是安装章节中在 `istio-system` 命名空间中创建的 `pod/istio-ingressgateway-86446666f9-qn4f2`，该 `Pod` 具有标签 `istio=ingressgateway`：

```
$ kubectl describe pod -n istio-system istio-ingressgateway-86446666f9-qn4f2
Name:             istio-ingressgateway-86446666f9-qn4f2
Namespace:        istio-system
Priority:         0
Service Account:  istio-ingressgateway-service-account
Node:             ctrlnode/172.19.106.26
Start Time:       Tue, 05 Mar 2024 11:37:41 +0800
Labels:           app=istio-ingressgateway
                  chart=gateways
                  heritage=Tiller
                  install.operator.istio.io/owning-resource=unknown
                  istio=ingressgateway
                  istio.io/rev=default
                  operator.istio.io/component=IngressGateways
                  pod-template-hash=86446666f9
                  release=istio
                  service.istio.io/canonical-name=istio-ingressgateway
                  service.istio.io/canonical-revision=latest
                  sidecar.istio.io/inject=false
Annotations:      istio.io/rev: default
                  ...
Status:           Running
IP:               10.42.0.12
IPs:
  IP:           10.42.0.12
Controlled By:  ReplicaSet/istio-ingressgateway-86446666f9
Containers:
  istio-proxy:
    Container ID:  docker://0f67dc1e5cdef226d6802679b8574d1f482d5bcd16bbdbafdef58604b80f7d05
    Image:         docker.io/istio/proxyv2:1.20.3
    Image ID:      docker-pullable://istio/proxyv2@sha256:18163bd4fdb641bdff1489e124a0b9f1059bb2cec9c8229161b73517db97c05a
    Ports:         15021/TCP, 8080/TCP, 8443/TCP, 31400/TCP, 15443/TCP, 15090/TCP
    Host Ports:    0/TCP, 0/TCP, 0/TCP, 0/TCP, 0/TCP, 0/TCP
    Args:
    ...
```

而 `Gateway` 中的端口 `8080` 匹配的到 `pod/istio-ingressgateway-86446666f9-qn4f2` 中暴露的端口 `8080`。集群的流量入口是从绑定到`pod/istio-ingressgateway-86446666f9-qn4f2`的`service/istio-ingressgateway`流入，然后根据 `Gateway` 所绑定的端口和配置将流量导入到最终的业务 `Pod` 中：

```
$  kubectl describe svc -n istio-system istio-ingressgateway
Name:                     istio-ingressgateway
Namespace:                istio-system
Labels:                   app=istio-ingressgateway
                          install.operator.istio.io/owning-resource=installed-state
                          install.operator.istio.io/owning-resource-namespace=istio-system
                          istio=ingressgateway
                          istio.io/rev=default
                          operator.istio.io/component=IngressGateways
                          operator.istio.io/managed=Reconcile
                          operator.istio.io/version=1.20.3
                          release=istio
Annotations:              metallb.universe.tf/ip-allocated-from-pool: mylocal-net-pool
Selector:                 app=istio-ingressgateway,istio=ingressgateway
Type:                     LoadBalancer
IP Family Policy:         SingleStack
IP Families:              IPv4
IP:                       10.43.114.120
IPs:                      10.43.114.120
LoadBalancer Ingress:     172.19.106.241
Port:                     status-port  15021/TCP
TargetPort:               15021/TCP
NodePort:                 status-port  32695/TCP
Endpoints:                10.42.0.12:15021
Port:                     http2  80/TCP
TargetPort:               8080/TCP
NodePort:                 http2  31783/TCP
Endpoints:                10.42.0.12:8080
Port:                     https  443/TCP
TargetPort:               8443/TCP
NodePort:                 https  30165/TCP
Endpoints:                10.42.0.12:8443
Port:                     tcp  31400/TCP
TargetPort:               31400/TCP
NodePort:                 tcp  32067/TCP
Endpoints:                10.42.0.12:31400
Port:                     tls  15443/TCP
TargetPort:               15443/TCP
NodePort:                 tls  31202/TCP
Endpoints:                10.42.0.12:15443
...
```

`istio-ingressgateway` 的外部IP是 `172.19.106.241`，对于 `bookinfo-gateway` 流量从 `172.19.106.241:80` 进入，然后转发到 `10.42.0.12:8080`，再根据 `Gateway` 和 `VirtualService` 的配置分发流量，`VirtualService` 就像 `K8S Gateway` 中的路由，可以根据具体的匹配条件将流量分发到不同的应用。上面简单介绍了网关的概念和入口流量的处理流程，创建成功之后能够得到下面的资源：

```
$  kubectl get gateway,virtualservice -n bookinfo-test -owide
NAME                                           AGE
gateway.networking.istio.io/bookinfo-gateway   23s

NAME                                          GATEWAYS               HOSTS   AGE
virtualservice.networking.istio.io/bookinfo   ["bookinfo-gateway"]   ["*"]   22s
```

在上面的流程分析中，其实已经得到网关入口的地址。也可以使用下面的命令进行获取，如果环境中安装了 `MetaLB`，也就是 `service/istio-ingressgateway` 有 `External-IP` 的时候使用下面的方式：

```
$ kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
172.19.106.241
$ kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.spec.ports[?(@.name=="http2")].port}'
80
```

所以可以使用 `http://172.19.106.241/productpage` 访问应用。如果没有安装 `MetaLB`，也可以使用节点的公网IP和`service/istio-ingressgateway`的`NodePort`进行访问，如下也可以使用 `http://172.19.106.26:31783/productpage` 端口进行访问：

```
$ ifconfig eth0
eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
    inet 172.19.106.26  netmask 255.255.240.0  broadcast 172.19.111.255
    inet6 fe80::215:5dff:fe21:66be  prefixlen 64  scopeid 0x20<link>
    ether 00:15:5d:21:66:be  txqueuelen 1000  (Ethernet)
    RX packets 644597  bytes 334969222 (334.9 MB)
    RX errors 0  dropped 0  overruns 0  frame 0
    TX packets 434839  bytes 54777350 (54.7 MB)
    TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0
$ kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.spec.ports[?(@.name=="http2")].nodePort}'
31783
```

#### 流量观测

为了能直观地看到上述服务中的流量转发情况，安装[kiali](https://istio.io/latest/docs/ops/integrations/kiali/)和[prometheus](https://istio.io/latest/docs/ops/integrations/prometheus/)进行演示：

> `kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/kiali.yaml`
> `kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/prometheus.yaml`

安装成功之后，可以看到如下的 `Service`：

```
$ kubectl get svc -n istio-system
...
kiali                  ClusterIP      10.43.79.213    <none>           20001/TCP,9090/TCP                                                           3m18s
prometheus             ClusterIP      10.43.164.98    <none>           9090/TCP                                                                     6s
```

`kiali` 默认是 `ClusterIP` 类型的，没法直接从外部进行访问，实验环境下可以将它改成`NodePort`或者`LoadBlancer`类型，这样就获得了从外部访问的入口。也可以通过下面的命令临时获得公网入口，`172.19.106.26` 是节点公网地址：

```
$ ./bin/istioctl dashboard kiali --address 172.19.106.26
http://172.19.106.26:20001/kiali
```

刷新 `productpage` 页面几次，然后在 `kiali` 页面看到如下的请求示意图：

![kaili流量转发示意图]()


#### 目标规则

在刷新产品页面的时候，会发现书籍的星级评分有时候有，有时候是红色的，有时候是黑色的，是因为服务的 `reviews` 的版本有三个，请求到不同的 `pod` 就会出现不同的结果：

```
$ kubectl get svc,pod -n bookinfo-test -owide
NAME                  TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE   SELECTOR
service/details       ClusterIP   10.43.161.132   <none>        9080/TCP   75m   app=details
service/ratings       ClusterIP   10.43.227.93    <none>        9080/TCP   75m   app=ratings
service/reviews       ClusterIP   10.43.234.246   <none>        9080/TCP   75m   app=reviews
service/productpage   ClusterIP   10.43.239.249   <none>        9080/TCP   75m   app=productpage

NAME                                 READY   STATUS    RESTARTS   AGE   IP           NODE           NOMINATED NODE   READINESS GATES
pod/details-v1-698d88b-rbmpg         2/2     Running   0          75m   10.42.0.19   ctrlnode       <none>           <none>
pod/reviews-v3-5b9bd44f4-bm2gr       2/2     Running   0          75m   10.42.0.23   ctrlnode       <none>           <none>
pod/reviews-v1-5b5d6494f4-gbdln      2/2     Running   0          75m   10.42.0.20   ctrlnode       <none>           <none>
pod/reviews-v2-5b667bcbf8-m78r7      2/2     Running   0          75m   10.42.0.22   ctrlnode       <none>           <none>
pod/ratings-v1-6484c4d9bb-mpl8c      2/2     Running   0          75m   10.42.0.21   ctrlnode       <none>           <none>
pod/productpage-v1-675fc69cf-248gs   2/2     Running   0          75m   10.42.0.24   ctrlnode       <none>           <none>
```

目标规则的意思就是将这些相同服务但不同版本以显示的方式指定，然后可以供 `VirtualService` 在转发流量是进行选择，在继续后面的章节之前，先应用默认的路由规则：

> `kubectl apply -n bookinfo-test -f samples/bookinfo/networking/destination-rule-all.yaml`

在 `destination-rule-all.yaml` 有一些用于后续实验的规则，挑其中一个进行说明：

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: reviews
spec:
  host: reviews
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
  - name: v3
    labels:
      version: v3
```

这里的 `host` 指的是服务的名称，`subsets` 用来声明这个服务内在的版本，这里指定了三个版本`v1`、`v2`和`v3`，分别用三个标签指向`3`个`reviews`的`Pod`。

#### 流量管理

`Istio` 的流量管理功能可以体现在路由版本分发，故障注入，流量转移，请求设置超时，熔断，地域负载均衡等过个方面。

##### 路由版本分发

本节继续基于前面的测试，将路由分发到具体的版本，例如，在这之前，刷新产品页面数据的评论信息一直在变动，这里通过简单的配置让他们都访问 `v1` 版本：

```
$ kubectl apply -n bookinfo-test -f samples/bookinfo/networking/virtual-service-all-v1.yaml
virtualservice.networking.istio.io/productpage created
virtualservice.networking.istio.io/reviews created
virtualservice.networking.istio.io/ratings created
virtualservice.networking.istio.io/details created
```

`virtual-service-all-v1.yaml` 中的内容如下，拿 `reviews` 这个 `VirtualService` 的配置来说，它会让所有访问 `reviews` 服务的请求都转发到 `v1` 版本：

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: productpage
spec:
  hosts:
  - productpage
  http:
  - route:
    - destination:
        host: productpage
        subset: v1
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
  - reviews
  http:
  - route:
    - destination:
        host: reviews
        subset: v1
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: ratings
spec:
  hosts:
  - ratings
  http:
  - route:
    - destination:
        host: ratings
        subset: v1
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: details
spec:
  hosts:
  - details
  http:
  - route:
    - destination:
        host: details
        subset: v1
---
```

此时如果再去刷新产品页面，评论信息是不会再有所变动的。还可以匹配具体的`HTTP`头信息，让具有某个请求头的用户访问某个版本。例如，更新刚才创建的`review VirtualService`，让用户`jason`访问 `v2`版本：

> `kubectl apply -n bookinfo-test -f samples/bookinfo/networking/virtual-service-reviews-test-v2.yaml`

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
  - match:
    - headers:
        end-user:
          exact: jason
    route:
    - destination:
        host: reviews
        subset: v2
  - route:
    - destination:
        host: reviews
        subset: v1
```

使用`jason`登录，密码任意，然后发现不管怎么刷新页面，书籍的评论都是固定的黑色星级样式。截止到目前，请求的流程如下所示：

- `productpage` → `reviews:v2` → `ratings` (针对 `jason` 用户)
- `productpage` → `reviews:v1` (其他用户)


##### 故障注入

故障注入可以分为延迟故障和`abort`故障。例如，针对下面的测试，在`jason`用户在访问`ratings`服务时，会引入1个`7s`的延迟：

> `kubectl apply -n bookinfo-test -f samples/bookinfo/networking/virtual-service-ratings-test-delay.yaml`

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: ratings
spec:
  hosts:
  - ratings
  http:
  - match:
    - headers:
        end-user:
          exact: jason
    fault:
      delay:
        percentage:
          value: 100.0
        fixedDelay: 7s
    route:
    - destination:
        host: ratings
        subset: v1
  - route:
    - destination:
        host: ratings
        subset: v1
```

如下在`jason`用户在访问`ratings`服务时，引入`500`响应，此时访问产品页，在评论的地方会出现 `Ratings service is currently unavailable` 这样的信息：

> `kubectl apply -n bookinfo-test  -f samples/bookinfo/networking/virtual-service-ratings-test-abort.yaml`

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: ratings
spec:
  hosts:
  - ratings
  http:
  - match:
    - headers:
        end-user:
          exact: jason
    fault:
      abort:
        percentage:
          value: 100.0
        httpStatus: 500
    route:
    - destination:
        host: ratings
        subset: v1
  - route:
    - destination:
        host: ratings
        subset: v1
```

清除本节注入的故障:

> `kubectl delete -n bookinfo-test -f samples/bookinfo/networking/virtual-service-ratings-test-delay.yaml`
> `kubectl delete -n bookinfo-test  -f samples/bookinfo/networking/virtual-service-ratings-test-abort.yaml`


##### 流量转移

流量转移通常用于版本升级过程中新版本不完全可信的时候，可以只将少部分的流量转移到新版本进行测试，待测试通过之后，再讲全部的流量进行导入。为了验证，这里先讲所有的流量都恢复到所有应用的`v1`版本：

> `kubectl apply -n bookinfo-test -f samples/bookinfo/networking/virtual-service-all-v1.yaml`

此时，假设对 `reviews` 应用进行了版本升级，要导入一部分流量进行测试，这里将导入`50%`的流量到`reviews v3`应用：

> `kubectl apply -n bookinfo-test -f samples/bookinfo/networking/virtual-service-reviews-50-v3.yaml`

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
  - route:
    - destination:
        host: reviews
        subset: v1
      weight: 50
    - destination:
        host: reviews
        subset: v3
      weight: 50
```

此时刷新产品页，应该有`50%`的几率看到红色的星级评价。如果测试完成，可以将全部流量导入到`reviews v3`：

> `kubectl apply -n bookinfo-test -f samples/bookinfo/networking/virtual-service-reviews-v3.yaml`

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
  - route:
    - destination:
        host: reviews
        subset: v3
```

##### 请求超时

将所有对 `reviews` 的访问都路由到 `v2` 版本，并且设置对`ratings`的访问增加固定的`2s`延迟：

```
kubectl apply -n bookinfo-test -f - <<EOF
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
  - route:
    - destination:
        host: reviews
        subset: v2
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: ratings
spec:
  hosts:
  - ratings
  http:
  - fault:
      delay:
        percent: 100
        fixedDelay: 2s
    route:
    - destination:
        host: ratings
        subset: v1
EOF
```

此时刷新产品页，页面响应正常，但是有`2s`延迟。现在设置对`reviews`的访问最大`0.5s`超时：

```
kubectl apply -n bookinfo-test -f - <<EOF
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
  - reviews
  http:
  - route:
    - destination:
        host: reviews
        subset: v2
    timeout: 0.5s
EOF
```

再去刷新页面，发现页面会在`1s`左右响应，但是评论获取失败。可以使用下面的命令将应用恢复到所有服务的`v1`版本：

> `kubectl apply -n bookinfo-test -f samples/bookinfo/networking/virtual-service-all-v1.yaml`

##### TCP流量转移

在测试之前首先设置测试环境：

> 1. 创建命名空间
> `kubectl create namespace istio-io-tcp-traffic-shifting`
> 2. 部署 sleep 应用程序，作为请求的测试源
> `kubectl apply -f samples/sleep/sleep.yaml -n istio-io-tcp-traffic-shifting`
> 3. 部署 tcp-echo 服务的 v1 和 v2 版本，作为服务端
> `kubectl apply -f samples/tcp-echo/tcp-echo-services.yaml -n istio-io-tcp-traffic-shifting`

首先将所有流量路由到`v1`版本的`tcp-echo`，`VirtualService` 中根据端口进行匹配：

> `kubectl apply -f samples/tcp-echo/tcp-echo-all-v1.yaml -n istio-io-tcp-traffic-shifting`

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: Gateway
metadata:
  name: tcp-echo-gateway
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 31400
      name: tcp
      protocol: TCP
    hosts:
    - "*"
---
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: tcp-echo-destination
spec:
  host: tcp-echo
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: tcp-echo
spec:
  hosts:
  - "*"
  gateways:
  - tcp-echo-gateway
  tcp:
  - match:
    - port: 31400
    route:
    - destination:
        host: tcp-echo
        port:
          number: 9000
        subset: v1
```

然后确定`TCP`流量的入口端口和`IP`，使用下面的命令进行获取：

```
$ kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
172.19.106.241
$ kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.spec.ports[?(@.name=="tcp")].port}'
31400
```

发送流量进行测试，响应都来自`tcp-echo`的`v1`版本（时间戳前面的`one`代表`v1`版本）:

```
$ #获取客户端的Pod名称
$ export SLEEP=$(kubectl get pod -l app=sleep -n istio-io-tcp-traffic-shifting -o jsonpath={.items..metadata.name})
$ for i in {1..20}; do \
> kubectl exec "$SLEEP" -c sleep -n istio-io-tcp-traffic-shifting -- sh -c "(date; sleep 1) | nc 172.19.106.241 31400"; \
> done
one Tue Mar  5 12:13:48 UTC 2024
one Tue Mar  5 12:13:50 UTC 2024
one Tue Mar  5 12:13:51 UTC 2024
one Tue Mar  5 12:13:52 UTC 2024
one Tue Mar  5 12:13:53 UTC 2024
one Tue Mar  5 12:13:54 UTC 2024
one Tue Mar  5 12:13:55 UTC 2024
one Tue Mar  5 12:13:56 UTC 2024
one Tue Mar  5 12:13:58 UTC 2024
one Tue Mar  5 12:13:59 UTC 2024
one Tue Mar  5 12:14:00 UTC 2024
one Tue Mar  5 12:14:01 UTC 2024
...
```

接下来将`20%`的流量路由到`v2`版本：

> `kubectl apply -f samples/tcp-echo/tcp-echo-20-v2.yaml -n istio-io-tcp-traffic-shifting`

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: tcp-echo
spec:
  hosts:
  - "*"
  gateways:
  - tcp-echo-gateway
  tcp:
  - match:
    - port: 31400
    route:
    - destination:
        host: tcp-echo
        port:
          number: 9000
        subset: v1
      weight: 80
    - destination:
        host: tcp-echo
        port:
          number: 9000
        subset: v2
      weight: 20
```

然后再进行测试，发现有`20%`的响应带有`two`前缀：

```
$ for i in {1..20}; do kubectl exec "$SLEEP" -c sleep -n istio-io-tcp-traffic-shifting -- sh -c "(date; sleep 1) | nc 172.19.106.241 31400"; done
one Tue Mar  5 12:16:56 UTC 2024
one Tue Mar  5 12:16:57 UTC 2024
one Tue Mar  5 12:16:59 UTC 2024
one Tue Mar  5 12:17:00 UTC 2024
one Tue Mar  5 12:17:01 UTC 2024
two Tue Mar  5 12:17:02 UTC 2024
one Tue Mar  5 12:17:03 UTC 2024
one Tue Mar  5 12:17:04 UTC 2024
one Tue Mar  5 12:17:06 UTC 2024
one Tue Mar  5 12:17:07 UTC 2024
two Tue Mar  5 12:17:08 UTC 2024
one Tue Mar  5 12:17:09 UTC 2024
two Tue Mar  5 12:17:10 UTC 2024
```

清理使用下面的命令：

> `kubectl delete ns --cascade istio-io-tcp-traffic-shifting`

##### 熔断

常见的服务容错措施包括，主动超时，限流，熔断，隔离，降级，其中熔断是指类似保险丝的保护措施，当某个异常情况出现时，切断前端服务和后端服务之间的链接，保护后端服务不受冲击。为了验证熔断场景的，首先做一些准备工作：

1. 创建命名空间并且设定标签：

    > `kubectl create ns circuit-breaking-test`
    > `kubectl label ns circuit-breaking-test istio-injection=enabled`

2. 创建用于测试的服务端：

    > `kubectl apply -n circuit-breaking-test -f samples/httpbin/httpbin.yaml`

3. 配置熔断器，设置[熔断规则](https://istio.io/latest/zh/docs/reference/config/networking/destination-rule/)，这里指定连接池的最大连接数是`1`，最大等待等请求数是`1`，这意味着如果并发的连接和请求数超过一个，在`istio-proxy`进行进一步的请求和连接时，后续的请求或者连接都会被阻止：

    ```
    kubectl apply -n circuit-breaking-test -f - <<EOF
    apiVersion: networking.istio.io/v1alpha3
    kind: DestinationRule
    metadata:
    name: httpbin
    spec:
    host: httpbin
    trafficPolicy:
        connectionPool:
        tcp:
            maxConnections: 1
        http:
            http1MaxPendingRequests: 1
            maxRequestsPerConnection: 1
        outlierDetection:
        consecutive5xxErrors: 1
        interval: 1s
        baseEjectionTime: 3m
        maxEjectionPercent: 100
    EOF
    ```

4. 创建用于测试的客户端，这里使用[fortio](https://github.com/fortio/fortio)，它可以控制连接数、并发数及发送`HTTP`请求的延迟，通过`Fortio`能够有效的触发前面在`DestinationRule`中设置的熔断策略：

    > `kubectl apply -n circuit-breaking-test -f samples/httpbin/sample-client/fortio-deploy.yaml`

5. 进入`fortio`客户端进行测试：

    ```
    $ export FORTIO_POD=$(kubectl get pods -n circuit-breaking-test -l app=fortio -o 'jsonpath={.items[0].metadata.name}')
    $ kubectl exec -n circuit-breaking-test  "$FORTIO_POD" -c fortio -- /usr/bin/fortio curl -quiet http://httpbin:8000/get
    HTTP/1.1 200 OK
    server: envoy
    date: Wed, 06 Mar 2024 02:55:28 GMT
    content-type: application/json
    content-length: 622
    access-control-allow-origin: *
    access-control-allow-credentials: true
    x-envoy-upstream-service-time: 80

    {
    "args": {},
    "headers": {
        "Host": "httpbin:8000",
        "User-Agent": "fortio.org/fortio-1.17.1",
        "X-B3-Parentspanid": "c168ff86036a18bb",
        "X-B3-Sampled": "1",
        "X-B3-Spanid": "c65d056e678f9c31",
        "X-B3-Traceid": "be3105420cdf261fc168ff86036a18bb",
        "X-Envoy-Attempt-Count": "1",
        "X-Forwarded-Client-Cert": "By=spiffe://cluster.local/ns/circuit-breaking-test/sa/httpbin;Hash=c690d3fd7f2a70f861c94b8ce5f68a773ae18a2df0dd9138a80627beb0926bec;Subject=\"\";URI=spiffe://cluster.local/ns/circuit-breaking-test/sa/default"
    },
    "origin": "127.0.0.6",
    "url": "http://httpbin:8000/get"
    }
    ```

6. 触发熔断规则，设置并发数`3`，结果显示只有`30%`的请求成功：

    ```
    $ kubectl exec -n circuit-breaking-test "$FORTIO_POD" -c fortio -- /usr/bin/fortio load -c 3 -qps 0 -n 30 -loglevel Warning http://httpbin:8000/get
    02:57:22 I logger.go:127> Log level is now 3 Warning (was 2 Info)
    Fortio 1.17.1 running at 0 queries per second, 12->12 procs, for 30 calls: http://httpbin:8000/get
    Starting at max qps with 3 thread(s) [gomax 12] for exactly 30 calls (10 per thread + 0)
    02:57:22 W http_client.go:806> [0] Non ok http code 503 (HTTP/1.1 503)
    02:57:22 W http_client.go:806> [0] Non ok http code 503 (HTTP/1.1 503)
    ...
    Ended after 34.5649ms : 30 calls. qps=867.93
    Aggregated Function Time : count 30 avg 0.00283299 +/- 0.003602 min 0.0003805 max 0.0138029 sum 0.0849897
    # range, mid point, percentile, count
    >= 0.0003805 <= 0.001 , 0.00069025 , 36.67, 11
    > 0.001 <= 0.002 , 0.0015 , 63.33, 8
    > 0.002 <= 0.003 , 0.0025 , 70.00, 2
    > 0.003 <= 0.004 , 0.0035 , 80.00, 3
    > 0.004 <= 0.005 , 0.0045 , 86.67, 2
    > 0.009 <= 0.01 , 0.0095 , 90.00, 1
    > 0.01 <= 0.011 , 0.0105 , 93.33, 1
    > 0.011 <= 0.012 , 0.0115 , 96.67, 1
    > 0.012 <= 0.0138029 , 0.0129015 , 100.00, 1
    # target 50% 0.0015
    # target 75% 0.0035
    # target 90% 0.01
    # target 99% 0.013262
    # target 99.9% 0.0137488
    Sockets used: 23 (for perfect keepalive, would be 3)
    Jitter: false
    Code 200 : 9 (30.0 %)
    Code 503 : 21 (70.0 %)
    Response Header Sizes : count 30 avg 69.033333 +/- 105.5 min 0 max 231 sum 2071
    Response Body/Total Sizes : count 30 avg 424.33333 +/- 280 min 241 max 853 sum 12730
    All done 30 calls (plus 0 warmup) 2.833 ms avg, 867.9 qps
    ```

7. 查看 `istio-proxy` 的状态以了解更多熔断的信息：

    > `kubectl exec -n circuit-breaking-test "$FORTIO_POD" -c istio-proxy -- pilot-agent request GET stats | grep httpbin | grep pending`
    ```
    $ kubectl exec -n circuit-breaking-test "$FORTIO_POD" -c istio-proxy -- pilot-agent request GET stats | grep httpbin | grep pending
    cluster.outbound|15021||httpbin-gateway-istio.circuit-breaking-test.svc.cluster.local.circuit_breakers.default.remaining_pending: 4294967295
    cluster.outbound|15021||httpbin-gateway-istio.circuit-breaking-test.svc.cluster.local.circuit_breakers.default.rq_pending_open: 0
    cluster.outbound|15021||httpbin-gateway-istio.circuit-breaking-test.svc.cluster.local.circuit_breakers.high.rq_pending_open: 0
    cluster.outbound|15021||httpbin-gateway-istio.circuit-breaking-test.svc.cluster.local.upstream_rq_pending_active: 0
    cluster.outbound|15021||httpbin-gateway-istio.circuit-breaking-test.svc.cluster.local.upstream_rq_pending_failure_eject: 0
    cluster.outbound|15021||httpbin-gateway-istio.circuit-breaking-test.svc.cluster.local.upstream_rq_pending_overflow: 0
    cluster.outbound|15021||httpbin-gateway-istio.circuit-breaking-test.svc.cluster.local.upstream_rq_pending_total: 0
    cluster.outbound|8000||httpbin.circuit-breaking-test.svc.cluster.local.circuit_breakers.default.remaining_pending: 1
    cluster.outbound|8000||httpbin.circuit-breaking-test.svc.cluster.local.circuit_breakers.default.rq_pending_open: 0
    cluster.outbound|8000||httpbin.circuit-breaking-test.svc.cluster.local.circuit_breakers.high.rq_pending_open: 0
    cluster.outbound|8000||httpbin.circuit-breaking-test.svc.cluster.local.upstream_rq_pending_active: 0
    cluster.outbound|8000||httpbin.circuit-breaking-test.svc.cluster.local.upstream_rq_pending_failure_eject: 0
    cluster.outbound|8000||httpbin.circuit-breaking-test.svc.cluster.local.upstream_rq_pending_overflow: 29
    cluster.outbound|8000||httpbin.circuit-breaking-test.svc.cluster.local.upstream_rq_pending_total: 32
    cluster.outbound|80||httpbin-gateway-istio.circuit-breaking-test.svc.cluster.local.circuit_breakers.default.remaining_pending: 4294967295
    cluster.outbound|80||httpbin-gateway-istio.circuit-breaking-test.svc.cluster.local.circuit_breakers.default.rq_pending_open: 0
    cluster.outbound|80||httpbin-gateway-istio.circuit-breaking-test.svc.cluster.local.circuit_breakers.high.rq_pending_open: 0
    cluster.outbound|80||httpbin-gateway-istio.circuit-breaking-test.svc.cluster.local.upstream_rq_pending_active: 0
    cluster.outbound|80||httpbin-gateway-istio.circuit-breaking-test.svc.cluster.local.upstream_rq_pending_failure_eject: 0
    cluster.outbound|80||httpbin-gateway-istio.circuit-breaking-test.svc.cluster.local.upstream_rq_pending_overflow: 0
    cluster.outbound|80||httpbin-gateway-istio.circuit-breaking-test.svc.cluster.local.upstream_rq_pending_total: 0
    ```


8. 清理测试现场使用如下方式：

    > `kubectl delete ns --cascade circuit-breaking-test`


#### 安全网关

前面章节创建的网关都是非安全类型的，本节演示如何使用 `TLS` 或者 `mTLS` 公开安全的 `HTTPS` 服务。首先，创建命名空间及部署用于测试`httpbin`服务：

> `kubectl create ns istio-tls-ingress-test`
> `kubectl apply -n istio-tls-ingress-test -f samples/httpbin/httpbin.yaml`

使用[mkcert](https://github.com/FiloSottile/mkcert)创建证书并且上传：

> `mkcert --cert-file httpbin.example.com.crt --key-file httpbin.example.com.key httpbin.example.com`
> `kubectl create -n istio-system secret tls httpbin-credential --key=httpbin.example.com.key --cert=httpbin.example.com.crt`

紧接着创建`Gateway` 和 `VirtualService`，为`httpbin.example.com`配置证书：

```
$ kubectl apply -n istio-tls-ingress-test -f - <<EOF
apiVersion: networking.istio.io/v1alpha3
kind: Gateway
metadata:
  name: mygateway
spec:
  selector:
    istio: ingressgateway # use istio default ingress gateway
  servers:
  - port:
      number: 443
      name: https
      protocol: HTTPS
    tls:
      mode: SIMPLE
      credentialName: httpbin-credential # must be the same as secret
    hosts:
    - httpbin.example.com
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: httpbin
spec:
  hosts:
  - "httpbin.example.com"
  gateways:
  - mygateway
  http:
  - match:
    - uri:
        prefix: /status
    - uri:
        prefix: /delay
    route:
    - destination:
        port:
          number: 8000
        host: httpbin
EOF
```

获取安全入口网关的地址和端口：

```
$ kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}'p}'
172.19.106.241
$ kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.spec.ports[?(@.name=="https")].port}'
443
```

`mkcert` 的根证书如果没有安装到系统的证书链中，可以在请求的时候显示添加。使用下面的命令查看 `mkcert` 的根证书位置:

```
$ mkcert -CAROOT
/root/.local/share/mkcert
$ ll $(mkcert -CAROOT)
...
-r-------- 1 root root 2484 Jan 17 17:29 rootCA-key.pem
-rw-r--r-- 1 root root 1639 Jan 17 17:29 rootCA.pem
```

使用 `curl` 命令进行测试：

```
$ curl -i -HHost:httpbin.example.com --resolve "httpbin.example.com:443:172.19.106.241" \
> --cacert /root/.local/share/mkcert/rootCA.pem "https://httpbin.example.com/status/418"
HTTP/2 418
server: istio-envoy
date: Wed, 06 Mar 2024 04:36:29 GMT
x-more-info: http://tools.ietf.org/html/rfc2324
access-control-allow-origin: *
access-control-allow-credentials: true
content-length: 135
x-envoy-upstream-service-time: 6


    -=[ teapot ]=-

       _...._
     .'  _ _ `.
    | ."` ^ `". _,
    \_;`"---"`|//
      |       ;/
      \_     _/
        `"""`
```

##### mTLS 

还可以配置服务端来验证客户端的是不是可信的，首先创建的包含证书的`httpbin-credential`需要包含`CA`证书：

> `kubectl delete secret -n istio-system httpbin-credential`
> `kubectl create -n istio-system secret generic httpbin-credential --from-file=tls.key=httpbin.example.com.key \`
> `  --from-file=tls.crt=httpbin.example.com.crt --from-file=ca.crt=/root/.local/share/mkcert/rootCA.pem`

然后将 `mygateway` 的 `tls` 模式设置为 `MUTUAL`：

```
$ kubectl apply -n istio-tls-ingress-test -f - <<EOF
apiVersion: networking.istio.io/v1alpha3
kind: Gateway
metadata:
  name: mygateway
spec:
  selector:
    istio: ingressgateway # use istio default ingress gateway
  servers:
  - port:
      number: 443
      name: https
      protocol: HTTPS
    tls:
      mode: MUTUAL
      credentialName: httpbin-credential # must be the same as secret
    hosts:
    - httpbin.example.com
EOF
```

在不提供客户端证书和私钥的情况下访问服务端必然错误：

```
$ curl -i -HHost:httpbin.example.com --resolve "httpbin.example.com:443:172.19.106.241" \
> --cacert /root/.local/share/mkcert/rootCA.pem "https://httpbin.example.com/status/418"
curl: (16) OpenSSL SSL_write: Broken pipe, errno 32
```

要解决该问题，首先需要生成客户端证书：

> `mkcert -client --cert-file client.crt --key-file client.key client.example.com`

然后附带客户端证书再去访问：

```
$ curl -i -HHost:httpbin.example.com --resolve "httpbin.example.com:443:172.19.106.241" \
> --cacert /root/.local/share/mkcert/rootCA.pem --cert client.crt --key client.key  "https://httpbin.example.com/status/418"
HTTP/2 418
server: istio-envoy
date: Wed, 06 Mar 2024 07:13:12 GMT
x-more-info: http://tools.ietf.org/html/rfc2324
access-control-allow-origin: *
access-control-allow-credentials: true
content-length: 135
x-envoy-upstream-service-time: 0


    -=[ teapot ]=-

       _...._
     .'  _ _ `.
    | ."` ^ `". _,
    \_;`"---"`|//
      |       ;/
      \_     _/
        `"""`
```

清理现场使用如下的命令：

> `kubectl delete ns --cascade istio-tls-ingress-test`
> `kubectl delete secret -n istio-system httpbin-credential`

#### TLS 终止

`TLS` 终止（也被称为 `SSL` 终止）是一个网络架构策略，其中 `TLS/SSL` 的连接或会话是在网络的某一层次上“终止”的，而不是在目标应用服务器上。这意味着解密操作（以及在响应中重新加密操作）发生在这一层次，而不是在实际的应用服务器上。这经常用于负载均衡器或专用的硬件设备中。简单来说就是在应用的入口处使用 `tls`，然而内部就全部采用 `HTTP` 协议，这样既保证了从外部进入的流量的安全，也保证了性能。

接下来会在一个名叫`tls-terminate-test`的命名空间中部署`httpbin`应用，期望在命名空间内使用`http`协议就可以访问引用，但是从其他命名空间访问时就必须使用安全的协议。为了实现这一点，得启用 `ENABLE_TLS_ON_SIDECAR_INGRESS` 功能：

> `istioctl install --set profile=demo --set values.pilot.env.ENABLE_TLS_ON_SIDECAR_INGRESS=true`

然后创建命名空间：

> `kubectl create ns tls-terminate-test`
> `kubectl label namespace tls-terminate-test istio-injection=enabled`

在该命名空间内，默认对所有工作负载启用 `mTLS` 功能，[PeerAuthentication](https://istio.io/latest/docs/reference/config/security/peer_authentication/) 定义是否以安全的方式将流量导入到 `Sidecar`：

```
$ kubectl -n tls-terminate-test apply -f - <<EOF
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
spec:
  mtls:
    mode: STRICT
EOF
```

创建用于客户端和服务端的证书：

> `mkcert --cert-file httpbin.svc.crt --key-file httpbin.svc.key httpbin.tls-terminate-test.svc.cluster.local`
> `mkcert -client --cert-file client.crt --key-file client.key client.tls-terminate-test.svc.cluster.local`

上传服务端的证书以及`CA`证书：

> `kubectl -n tls-terminate-test create secret generic ca-secret --from-file=ca.crt=/root/.local/share/mkcert/rootCA.pem`
> `kubectl -n tls-terminate-test create secret tls httpbin-svc-secret --cert httpbin.svc.crt --key httpbin.svc.key`

部署测试应用，在下面的模板使用 `sidecar.istio.io/userVolumeMount` 注解为 `istio-proxy Sidecar` 挂载证书，目前 `Istio Sidecar` 还不支持 `credentialName` 配置：

```
$ kubectl -n tls-terminate-test apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: httpbin
---
apiVersion: v1
kind: Service
metadata:
  name: httpbin
  labels:
    app: httpbin
    service: httpbin
spec:
  ports:
    - port: 443
      name: https
      targetPort: 9443
    - port: 80
      name: http
      targetPort: 9080
  selector:
    app: httpbin
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: httpbin
spec:
  replicas: 1
  selector:
    matchLabels:
      app: httpbin
      version: v1
  template:
    metadata:
      labels:
        app: httpbin
        version: v1
      annotations:
        sidecar.istio.io/userVolume: '{"tls-secret":{"secret":{"secretName":"httpbin-svc-secret","optional":true}},"tls-ca-secret":{"secret":{"secretName":"ca-secret"}}}'
        sidecar.istio.io/userVolumeMount: '{"tls-secret":{"mountPath":"/etc/istio/tls-certs/","readOnly":true},"tls-ca-secret":{"mountPath":"/etc/istio/tls-ca-certs/","readOnly":true}}'
    spec:
      serviceAccountName: httpbin
      containers:
      - image: docker.io/kennethreitz/httpbin
        imagePullPolicy: IfNotPresent
        name: httpbin
        ports:
        - containerPort: 80
EOF
```

接下来配置 [Sidecar](https://istio.io/latest/zh/docs/reference/config/networking/sidecar/#IstioIngressListener) 让它监听 `9433` 和 `9080` 端口的流量，并且在 `9443` 端口上启用 `mTLS` 验证：

```
$ kubectl -n tls-terminate-test apply -f - <<EOF
apiVersion: networking.istio.io/v1alpha3
kind: Sidecar
metadata:
  name: ingress-sidecar
spec:
  workloadSelector:
    labels:
      app: httpbin
      version: v1
  ingress:
  - port:
      number: 9443
      protocol: HTTPS
      name: external
    defaultEndpoint: 0.0.0.0:80
    tls:
      mode: MUTUAL
      privateKey: "/etc/istio/tls-certs/tls.key"
      serverCertificate: "/etc/istio/tls-certs/tls.crt"
      caCertificates: "/etc/istio/tls-ca-certs/ca.crt"
  - port:
      number: 9080
      protocol: HTTP
      name: internal
    defaultEndpoint: 0.0.0.0:80
EOF
```

最后为了达到能在应用内部通过 `http` 协议进行访问的目标，使用 `PeerAuthentication` 禁用 `9080` 的 `mTLS` 验证：

```
$ kubectl -n tls-terminate-test apply -f - <<EOF
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: disable-peer-auth-for-external-mtls-port
spec:
  selector:
    matchLabels:
      app: httpbin
  mtls:
    mode: STRICT
  portLevelMtls:
    9080:
      mode: DISABLE
EOF
```

准备就绪之后，开始测试，首先安装在 `tls-terminate-test` 和 `default` 安装客户端：

> `kubectl apply -f samples/sleep/sleep.yaml`
> `kubectl -n tls-terminate-test apply -f samples/sleep/sleep.yaml`

然后在`tls-terminate-test`内部测试`80`端口的可用性：

```
$ export INTERNAL_CLIENT=$(kubectl -n tls-terminate-test get pod -l app=sleep -o jsonpath={.items..metadata.name})
$ kubectl -n tls-terminate-test exec "${INTERNAL_CLIENT}" -c sleep -- curl -IsS "http://httpbin/status/200"
HTTP/1.1 200 OK
server: envoy
date: Wed, 06 Mar 2024 10:41:50 GMT
content-type: text/html; charset=utf-8
access-control-allow-origin: *
access-control-allow-credentials: true
content-length: 0
x-envoy-upstream-service-time: 4
```

从外部测试`443`端口的可用性，从外部测试，需要将客户端证书复制到`default.sleep`中再进行测试，`443`端口请求成功，而`80`端口则被拒绝：

```
$ export EXTERNAL_CLIENT=$(kubectl get pod -l app=sleep -o jsonpath={.items..metadata.name})
$ kubectl cp client.key default/"${EXTERNAL_CLIENT}":/tmp/ -c sleep
$ kubectl cp client.crt default/"${EXTERNAL_CLIENT}":/tmp/ -c sleep
$ kubectl cp /root/.local/share/mkcert/rootCA.pem default/"${EXTERNAL_CLIENT}":/tmp/ca.crt -c sleep
$ kubectl exec "${EXTERNAL_CLIENT}" -c sleep -- curl -IsS --cacert /tmp/ca.crt --key /tmp/client.key \
> --cert /tmp/client.crt -HHost:httpbin.tls-terminate-test "https://httpbin.tls-terminate-test:443/status/200"
server: istio-envoy
date: Wed, 06 Mar 2024 11:41:50 GMT
content-type: text/html; charset=utf-8
access-control-allow-origin: *
access-control-allow-credentials: true
content-length: 0
x-envoy-upstream-service-time: 4
x-envoy-decorator-operation: ingress-sidecar.test:9080/*
$ kubectl exec "${EXTERNAL_CLIENT}" -c sleep -- curl -IsS --cacert /tmp/ca.crt --key /tmp/client.key \
> --cert /tmp/client.crt -HHost:httpbin.tls-terminate-test "http://httpbin.tls-terminate-test/status/200"
curl: (56) Recv failure: Connection reset by peer
command terminated with exit code 56
```

清理测试现场使用如下的命令：

> `kubectl delete ns --cascade tls-terminate-test`
> `kubectl delete svc,deploy sleep`

#### TLS 非终止

`TLS` 终止是将安全会话在网关层结束掉，在流量进入内部的时候，使用非安全协议以提升性能，`TLS` 非终止的意思就是将安全流量直接送达到应用，那么应用也需要能够处理安全流量。为了验证，首先做以下准备：

> `mkcert --cert-file nginx.example.com.crt --key-file nginx.example.com.key nginx.example.com` 
> `kubectl create ns tls-passthrough-test`
> `kubectl create -n tls-passthrough-test secret tls nginx-tls-secret --cert=nginx.example.com.crt --key=nginx.example.com.key`

将下面的的`Nginx`的配置信息保存在`nginx.conf`文件中：

```
events {
}

http {
  log_format main '$remote_addr - $remote_user [$time_local]  $status '
  '"$request" $body_bytes_sent "$http_referer" '
  '"$http_user_agent" "$http_x_forwarded_for"';
  access_log /var/log/nginx/access.log main;
  error_log  /var/log/nginx/error.log;

  server {
    listen 443 ssl;

    root /usr/share/nginx/html;
    index index.html;

    server_name nginx.example.com;
    ssl_certificate /etc/nginx-server-certs/tls.crt;
    ssl_certificate_key /etc/nginx-server-certs/tls.key;
  }
}
```

从配置文件创建 `configmap`：

> `kubectl create -n tls-passthrough-test configmap nginx-configmap --from-file=nginx.conf=./nginx.conf`

创建应用，挂载配置文件以及证书：

```
$ kubectl apply -n tls-passthrough-test -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: my-nginx
  labels:
    run: my-nginx
spec:
  ports:
  - port: 443
    protocol: TCP
  selector:
    run: my-nginx
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-nginx
spec:
  selector:
    matchLabels:
      run: my-nginx
  replicas: 1
  template:
    metadata:
      labels:
        run: my-nginx
        sidecar.istio.io/inject: "true"
    spec:
      containers:
      - name: my-nginx
        image: nginx
        ports:
        - containerPort: 443
        volumeMounts:
        - name: nginx-config
          mountPath: /etc/nginx
          readOnly: true
        - name: nginx-server-certs
          mountPath: /etc/nginx-server-certs
          readOnly: true
      volumes:
      - name: nginx-config
        configMap:
          name: nginx-configmap
      - name: nginx-server-certs
        secret:
          secretName: nginx-tls-secret
EOF
```

创建网关和路由，注意的是这里网关`tls`的模式是`PASSTHROUGH`，路由信息中也是用了 `SNI` 匹配具体的 `nginx.example.com` 的流量：

```
kubectl apply -n tls-passthrough-test -f - <<EOF
apiVersion: networking.istio.io/v1alpha3
kind: Gateway
metadata:
  name: mygateway
spec:
  selector:
    istio: ingressgateway # use istio default ingress gateway
  servers:
  - port:
      number: 443
      name: https
      protocol: HTTPS
    tls:
      mode: PASSTHROUGH
    hosts:
    - nginx.example.com
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: nginx
spec:
  hosts:
  - nginx.example.com
  gateways:
  - mygateway
  tls:
  - match:
    - port: 443
      sniHosts:
      - nginx.example.com
    route:
    - destination:
        host: my-nginx
        port:
          number: 443
EOF
```

获取网关的安全入口：

```
$ kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
172.19.106.241
$ kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.spec.ports[?(@.name=="https")].port}'
443
```

使用 `curl` 命令进行测试：

```
$ curl -i --resolve "nginx.example.com:443:172.19.106.241" --cacert /root/.local/share/mkcert/rootCA.pem https://nginx.example.com
HTTP/1.1 200 OK
Server: nginx/1.21.5
Date: Thu, 07 Mar 2024 02:00:09 GMT
Content-Type: text/html
Content-Length: 615
Last-Modified: Tue, 28 Dec 2021 15:28:38 GMT
Connection: keep-alive
ETag: "61cb2d26-267"
Accept-Ranges: bytes

<!DOCTYPE html>
...
```

清理测试环境：

> `kubectl delete ns --cascade tls-passthrough-test`

#### 指标可视化

本节的展示需要安装 `Grafana` 和 `prometheus` 组件，以及部署 `bookinfo` 测试应用。如果没有部署的话，可以按照下面的命令：

> `kubectl create ns bookinfo-test`
> `kubectl label namespace bookinfo-test istio-injection=enabled`
> `kubectl apply -n bookinfo-test -f samples/bookinfo/platform/kube/bookinfo.yaml`
> `kubectl apply -n bookinfo-test -f samples/bookinfo/networking/bookinfo-gateway.yaml`
> `kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/grafana.yaml`
> `kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/addons/prometheus.yaml`

等待所有的 `pod` 就绪之后，可以在 `istio-system` 命名空间中看到如下的服务：

```
$ kubectl get svc -n istio-system
NAME                   TYPE           CLUSTER-IP      EXTERNAL-IP      PORT(S)                                                                      AGE
kiali                  ClusterIP      10.43.79.213    <none>           20001/TCP,9090/TCP                                                           43h
prometheus             ClusterIP      10.43.164.98    <none>           9090/TCP                                                                     43h
istiod                 ClusterIP      10.43.60.212    <none>           15010/TCP,15012/TCP,443/TCP,15014/TCP                                        17h
istio-egressgateway    ClusterIP      10.43.98.212    <none>           80/TCP,443/TCP                                                               17h
istio-ingressgateway   LoadBalancer   10.43.189.254   172.19.106.241   15021:31226/TCP,80:30136/TCP,443:32306/TCP,31400:30766/TCP,15443:31588/TCP   17h
grafana                ClusterIP      10.43.160.149   <none>           3000/TCP                                                                     28m
```

通过下面的方式获取网关的入口：

```
$ kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
172.19.106.241
$ kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.spec.ports[?(@.name=="http2")].port}'
80
```

请求 `http://172.19.106.241/productpage`，以获得数据，可以使用压测工具持续发送流量。打开 `prometheus` 查看指标：

> `istioctl dashboard prometheus --address 172.19.106.26`

输入查询语句以获得指标和图标可视化：

> `istio_requests_total`

`Grafana` 是一个开源的监控解决方案，可以用来为 `Istio` 配置仪表板。使用如下的命令打开 `grafana` 指标：

> `istioctl dashboard grafana --address 172.19.106.26`

打开 `http://172.19.106.26:3000/dashboards` 页面，可以查看相关的指标。

#### 插入CA证书

本节为了测试，最好卸载重新安装 `istio`：

> `istioctl uninstall --purge`
> `istioctl install --set profile=demo`
> `kubectl create namespace istio-system`

这里导入 `mkcert` 的根证书，保存在 `istio-system` 命名空间中名为 `cacerts` 的 `secret` 中：

```
kubectl create secret generic cacerts -n istio-system \
  --from-file=ca-cert.pem=/root/.local/share/mkcert/rootCA.pem \
  --from-file=ca-key.pem=/root/.local/share/mkcert/rootCA-key.pem \
  --from-file=root-cert.pem=/root/.local/share/mkcert/rootCA.pem \
  --from-file=cert-chain.pem=/root/.local/share/mkcert/rootCA.pem
```

部署应用进行测试：

> `kubectl create ns foo`
> `kubectl apply -f <(istioctl kube-inject -f samples/httpbin/httpbin.yaml) -n foo`
> `kubectl apply -f <(istioctl kube-inject -f samples/sleep/sleep.yaml) -n foo`

在 `foo` 命名空间中部署一个策略，只接受双向 `mTLS` 流量：

```
$ kubectl apply -n foo -f - <<EOF
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: "default"
spec:
  mtls:
    mode: STRICT
EOF
```

等待策略生效并且导出证书：

```
$ sleep 20; kubectl exec "$(kubectl get pod -l app=sleep -n foo -o jsonpath={.items..metadata.name})" \
> -c istio-proxy -n foo -- openssl s_client -showcerts -connect httpbin.foo:8000 > httpbin-proxy-cert.txt
```

解析证书链中的证书：

```
$ sed -n '/-----BEGIN CERTIFICATE-----/{:start /-----END CERTIFICATE-----/!{N;b start};/.*/p}' httpbin-proxy-cert.txt > certs.pem
$ awk 'BEGIN {counter=0;} /BEGIN CERT/{counter++} { print > "proxy-cert-" counter ".pem"}' < certs.pem
```

验证服务的证书是否OK：

```
$ openssl verify -CAfile <(cat /root/.local/share/mkcert/rootCA.pem) ./proxy-cert-1.pem
./proxy-cert-1.pem: OK
```

也可以通过下面的的方式查看`Pod`证书：

```
$ kubectl get pods -n foo -owide
NAME                      READY   STATUS    RESTARTS   AGE   IP           NODE           NOMINATED NODE   READINESS GATES
httpbin-84d967465-h564v   2/2     Running   0          14m   10.42.0.63   ctrlnode       <none>           <none>
sleep-78f7ddc675-pcr8h    2/2     Running   0          13m   10.42.0.64   ctrlnode       <none>           <none>
$ istioctl proxy-config secret httpbin-84d967465-h564v.foo -o json | jq -r '.dynamicActiveSecrets[0].secret.tlsCertificate.certificateChain.inlineBytes' | base64 --decode | openssl x509 -text -noout
...
$ istioctl proxy-config secret sleep-78f7ddc675-pcr8h.foo -o json | jq -r '.dynamicActiveSecrets[0].secret.tlsCertificate.certificateChain.inlineBytes' | base64 --decode | openssl x509 -text -noout
Certificate:
    Data:
        Version: 3 (0x2)
        Serial Number:
            21:26:d4:ce:39:af:72:7d:16:9d:98:3a:83:dc:d0:78
        Signature Algorithm: sha256WithRSAEncryption
        Issuer: O = mkcert development CA, OU = root@F00596107-PX, CN = mkcert root@F00596107-PX
        Validity
            Not Before: Mar  7 06:55:18 2024 GMT
            Not After : Mar  8 06:57:18 2024 GMT
        Subject:
        Subject Public Key Info:
            Public Key Algorithm: rsaEncryption
                Public-Key: (2048 bit)
                Modulus:
                ...
```

#### 增加端口

`istio` 默认的网关只有固定的几个端口，如果有需要新增端口，可以按照下面的流程操作。首先编辑 `istio-ingressgateway` 增加端口：

```
$ kubectl edit svc istio-ingressgateway -n istio-system
....
spec:
  ports:
  ...
  - name: custom-port
    port: 3000
    protocol: TCP
    targetPort: 8080
```

部署应用进行验证：

```
$ kubectl create ns custom-port-test
$ kubectl label namespace custom-port-test istio-injection=enabled
$ kubectl apply -n custom-port-test -f samples/httpbin/httpbin.yaml
$ kubectl apply -n custom-port-test -f - <<EOF
apiVersion: networking.istio.io/v1alpha3
kind: Gateway
metadata:
  name: mygateway
spec:
  selector:
    istio: ingressgateway # use istio default ingress gateway
  servers:
  - port:
      number: 3000
      name: http
      protocol: HTTP
    hosts:
    - "*"
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: httpbin
spec:
  hosts:
  - "*"
  gateways:
  - mygateway
  http:
  - match:
    - port: 3000
    route:
    - destination:
        port:
          number: 8000
        host: httpbin
EOF
$ kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
172.19.106.241
$ kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.spec.ports[?(@.name=="custom-port")].port}'
3000
$ curl -i http://172.19.106.241:3000
HTTP/1.1 200 OK
server: istio-envoy
date: Thu, 07 Mar 2024 08:24:02 GMT
content-type: text/html; charset=utf-8
content-length: 9593
access-control-allow-origin: *
access-control-allow-credentials: true
x-envoy-upstream-service-time: 8

<!DOCTYPE html>
....
```

清理现场使用：

> `kubectl delete ns --cascade custom-port-test`


### 参考链接

1. https://istio.io/latest/docs/
2. https://www.ctyun.cn/developer/article/453939699036229
