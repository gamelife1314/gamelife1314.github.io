---
title: K8S Gateway
date: 2024-03-01 16:07:57
tags:
    - gateway
    - ingress
    - istio-gateway
categories:
    - k8s
---

为了从外部能够访问到集群中的服务，k8S 提供了多种方式，从 `NodePort` 类型的 `Service`，`LoadBalancer` 类型的 `Service`，到 `Ingress`，一直在改进，`NodePort`类型的服务流量从单一节点进来，没法在节点之间负载均衡，进而衍生出`LoadBalancer`类型的服务，该类型的服务虽然解决了前面存在的问题，但是需要云厂商的支持，况且针对每个`Service`粒度提供一个公网`IP`地址，未免有点浪费，进而衍生出 `Ingress`，支持7层代理，能够通过单一的入口，以及域名和`Path`匹配等机制将流量转发到不同的后端服务中去。`Ingress` 虽然解决了`LoadBalancer`存在的问题，但它在实际的使用场景中又遇到了新的问题：

1. `Ingress` 仅支持`7`层，没法对四层的流量进行转发；
2. `Ingress` 在设计的时候只考虑一种用户角色，既整个系统的运维人员和管理员，这种模型在许多拥有多个团队的企业中都不适用，包括应用开发人员、平台运维人员、安全管理员等，他们在协作开发和交付应用的过程中需要控制`Ingress`配置的不同方面；
3. `Ingress` 中使用了很多`annotion`实现自定义功能，对于不同的 `ingress controller` 没法做到一致性，例如，这里的 [nginx annotions](https://github.com/kubernetes/ingress-nginx/blob/main/docs/user-guide/nginx-configuration/annotations.md)，这些在原本的 `Ingress` 对象中都是不支持的；

在这些问题的促使下，社区又提出了新的概念：[Gateway](https://gateway-api.sigs.k8s.io/)，明确定义并划分不同角色的职责范围有助于简化管理，对三个主要的 `Gateway API` 资源（`GatewayClass`、`Gateway` 和 `Route`）进行了标准化。具体来说，基础架构提供商负责为 `Kubernetes` 集群定义 `GatewayClasses`，集群运维人员则负责在集群中部署和配置 `Gateway`（包括策略），而应用开发人员可以自由地将 `Route` 附加到 `Gateway`，以对外暴露应用。

{% asset_img ttps://www.nginx-cn.net/wp-content/uploads/2022/06/5-things-NGINX-Kubernetes-Gateway_RBAC.png %}

<!-- more -->

### 安装

`Gateway` 相关的资源没有在`K8S`中预置，因为它还在不断发展，在使用之前需要先安装相关的资源，这里分为两个版本：稳定版和实验版，实验版本相比标准稳定版多了 `TCPRoute`，`TLSRoute`，`UDPRoute`，`GRPCRoute`，根据选用的的 `Gateway Controller` 的支持程度做选择即可。稳定版执行下下面的命令进行安装：

> `kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.0.0/standard-install.yaml`

实验版本使用下面的命令进行安装：

> `kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.0.0/experimental-install.yaml`

这里选用的 [istio](https://istio.io/latest/zh/docs/setup/install/istioctl/) 作为`Gateway`的实现，参考`istio`的安装指南进行安装。安装成功之后，能看到一个 `istio` 的 `GatewayClass` 对象：

```
$ kubectl describe gatewayclass -n istio-system istio
Name:         istio
Namespace:
Labels:       <none>
Annotations:  <none>
API Version:  gateway.networking.k8s.io/v1
Kind:         GatewayClass
Metadata:
  Creation Timestamp:  2024-03-01T07:49:53Z
  Generation:          1
  Resource Version:    731627
  UID:                 b3926b53-612b-4941-acce-d6d7bf0e9f3b
Spec:
  Controller Name:  istio.io/gateway-controller
  Description:      The default Istio GatewayClass
Status:
  Conditions:
    Last Transition Time:  2024-03-01T07:49:53Z
    Message:               Handled by Istio controller
    Observed Generation:   1
    Reason:                Accepted
    Status:                True
    Type:                  Accepted
Events:                    <none>
```

### Gateway

上面的安装步骤完成之后，就可以创建一个`Gateway`进行使用了，这部分主要是集群运维人员的工作。为了能全面的展示`Gateway API`，这里使用了`https`协议，首先创建证书并且上传，使用到的[mkcert](https://github.com/FiloSottile/mkcert)需要提前安装：

> `mkcert --cert-file web.local.dev.crt -key-file web.local.dev.key web.local.dev`
> `kubectl create -n nginx-gateway secret tls web.local.dev-crt --cert=web.local.dev.crt --key=web.local.dev.key`

```
kubectl apply -f - <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: local-gateway
  namespace: istio-system
spec:
  gatewayClassName: istio
  listeners:
    - protocol: HTTPS
      port: 9443
      name: web-gw
      hostname: web.local.dev
      allowedRoutes:
        kinds:
          - kind: HTTPRoute
        namespaces:
          from: Selector
          selector:
            matchLabels:
              shared-gateway-access: "true"
            matchExpressions:
              - key: kubernetes.io/metadata.name
                operator: In
                values:
                  - gateway-test
      tls:
        mode: Terminate 
        certificateRefs:
          - name: web.local.dev-crt 
            kind: Secret  
            group: ""
EOF
```

对 `Gateway` 中的重点概念做下解释：

- `spec.gatewayClassName`：指定要使用的 `Gateway Controller`，这里使用上一节安装的 `istio`；
- `spec.listeners.hostname`：网关的名称，如果要使用 `HTTPS` 协议， 在指定了 `spec.listeners.tls` 时，该字段必须指定，且附加到该网关的 `HTTPRoute` 中的 `hostnames` 字段至少包含这里声明的 `hostname`； 
- `spec.listeners.allowedRoutes.namespace`：指定允许哪些命名空间的 `HTTProute` 附加到这个网关中：
    - `kinds`：允许那种路由添加到这个网关中；
    - `from`：可以取值 `Same`，表示只有和网关在相同命名空间的路由才可以添加到这个网关中；`All` 表示允许所有命名空间的路由添加到这个网关中；`Selector` 允许选择器选择匹配的命名空间中的路由添加到这个网关中；
    - `selector.matchLabels`：选择具有 `shared-gateway-access: "true"` 标记的命名空间；
    - `selector.matchLabels`：这里允许 `gateway-test` 这个命名中的路由添加到网关；


执行成功之后，能看到下面的对象，其中 `local-gateway-istio service` 是整个 `local-gateway` 的入口，被`metalb`分配了`172.19.106.241`地址，它接受到的请求转发给 `local-gateway-istio-fb7447f46-g56gm` 这个 `Pod` 进行处理，它负责对路由配置的解释，根据 `HTTPRoute` 配置的规则将流量转发给对应的后端服务：

```
$ kubectl get svc local-gateway-istio -n istio-system -owide
NAME                  TYPE           CLUSTER-IP     EXTERNAL-IP      PORT(S)                          AGE   SELECTOR
local-gateway-istio   LoadBalancer   10.43.113.75   172.19.106.241   15021:31230/TCP,9443:30992/TCP   20h   istio.io/gateway-name=local-gateway
$ kubectl describe svc local-gateway-istio -n istio-system
Name:                     local-gateway-istio
Namespace:                istio-system
Labels:                   gateway.istio.io/managed=istio.io-gateway-controller
Annotations:              metallb.universe.tf/ip-allocated-from-pool: mylocal-net-pool
Selector:                 istio.io/gateway-name=local-gateway
Type:                     LoadBalancer
IP Family Policy:         SingleStack
IP Families:              IPv4
IP:                       10.43.113.75
IPs:                      10.43.113.75
LoadBalancer Ingress:     172.19.106.241
Port:                     status-port  15021/TCP
TargetPort:               15021/TCP
NodePort:                 status-port  31230/TCP
Endpoints:                10.42.0.112:15021
Port:                     web-gw  9443/TCP
TargetPort:               9443/TCP
NodePort:                 web-gw  30992/TCP
Endpoints:                10.42.0.112:9443
Session Affinity:         None
External Traffic Policy:  Cluster
Events:
  Type    Reason           Age                From                Message
  ----    ------           ----               ----                -------
  Normal  ClearAssignment  52s                metallb-controller  current IP for "istio-system/local-gateway-istio" not allowed by config, will attempt for new IP assignment: ["172.31.46.244"] is not allowed in config
  Normal  IPAllocated      52s                metallb-controller  Assigned IP ["172.19.106.241"]
  Normal  nodeAssigned     41s (x9 over 20h)  metallb-speaker     announcing from node "f00596107-px" with protocol "layer2"
$ kubectl get gateway local-gateway -n istio-system -owide
NAME            CLASS   ADDRESS          PROGRAMMED   AGE
local-gateway   istio   172.19.106.241   True         20h
$ kubectl get secret web.local.dev-crt -n istio-system -owide
NAME                TYPE                DATA   AGE
web.local.dev-crt   kubernetes.io/tls   2      11m
$ kubectl get pods -n istio-system -owide
NAME                                    READY   STATUS    RESTARTS      AGE    IP            NODE           NOMINATED NODE   READINESS GATES
...
local-gateway-istio-fb7447f46-g56gm     1/1     Running   0             13m    10.42.0.112   f00596107-px   <none>           <none>
```

### 功能介绍

前面的配置一般由集群的运维人员进行，现在需要开发人员登场将自己的开发的应用接入到网关中，这样用户就可以从外部进行访问了。

#### HTTPRoute

使用 `kubectl` 部署下面的 `whoami` 服务进行测试：

```
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: gateway-test
  labels:
    shared-gateway-access: "true"
---
apiVersion: v1
kind: Service
metadata:
  name: whoami-svc
  namespace: gateway-test
spec:
  ports:
    - port: 8080
      name: http
      targetPort: 80
  selector:
    app: whoami
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: whoami-deploy
  namespace: gateway-test
  labels:
    app: whoami
spec:
  replicas: 1
  selector:
    matchLabels:
      app: whoami
  template:
    metadata:
      labels:
        app: whoami
    spec:
      containers:
      - name: whoami
        image: traefik/whoami
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 80
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: whoami-http-route
  namespace: gateway-test
spec:
  parentRefs:
    - name: local-gateway
      namespace: istio-system
  hostnames:
    - "web.local.dev"
  rules:
    - matches:
      - path:
          type: PathPrefix
          value: /whoami
      backendRefs:
        - name: whoami-svc
          port: 8080
EOF
```

对上面的一些关键点进行解释：

1. 命名空间的名称 `gateway-test` 以及它的标签：`shared-gateway-access: "true"` 是他被`Gateway`认可的标识，在创建 `Gateway` 的时候指定具有这个特征的命名空间中的`HTTPRoute`才会被接受；
2. 创建 `whoami-svc` 用于处理实际的请求，它会将请求转发到具有 `app=whoami` 的 `Pod` 进行处理；
3. 创建 `HTTPRoute` 路由，使用 `istio-system` 命名空间中的 `local-gateway` Gateway 作为网关，匹配`Host`为`web.local.dev`，且以`/whoami`开始的请求转发给`whoami-svc`的`8080`端口进行处理；

上面的命令执行成功之后，将能看到下面这些资源信息：

> `kubectl get svc,pod,deploy,rs,httproute -n gateway-test -owide`

```
$ kubectl get svc,pod,deploy,rs,httproute -n gateway-test -owide
NAME                 TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE   SELECTOR
service/whoami-svc   ClusterIP   10.43.131.190   <none>        8080/TCP   24m   app=whoami

NAME                                 READY   STATUS    RESTARTS   AGE   IP            NODE           NOMINATED NODE   READINESS GATES
pod/whoami-deploy-6cc79b7f7d-trvtd   1/1     Running   0          24m   10.42.0.115   f00596107-px   <none>           <none>

NAME                            READY   UP-TO-DATE   AVAILABLE   AGE   CONTAINERS   IMAGES           SELECTOR
deployment.apps/whoami-deploy   1/1     1            1           24m   whoami       traefik/whoami   app=whoami

NAME                                       DESIRED   CURRENT   READY   AGE   CONTAINERS   IMAGES           SELECTOR
replicaset.apps/whoami-deploy-6cc79b7f7d   1         1         1       24m   whoami       traefik/whoami   app=whoami,pod-template-hash=6cc79b7f7d

NAME                                                    HOSTNAMES           AGE
httproute.gateway.networking.k8s.io/whoami-http-route   ["web.local.dev"]   24m
```

使用 `curl` 命令进行结果验证：

> `curl -i --resolve web.local.dev:9443:172.19.106.241 https://web.local.dev:9443/whoami`

```
$ curl -i --resolve web.local.dev:9443:172.19.106.241 https://web.local.dev:9443/whoami
HTTP/2 200
date: Sat, 02 Mar 2024 07:02:36 GMT
content-length: 1403
content-type: text/plain; charset=utf-8
x-envoy-upstream-service-time: 2
server: istio-envoy

Hostname: whoami-deploy-6cc79b7f7d-trvtd
IP: 127.0.0.1
IP: 10.42.0.115
RemoteAddr: 10.42.0.112:34310
GET /whoami HTTP/1.1
Host: web.local.dev:9443
User-Agent: curl/7.81.0
Accept: */*
X-B3-Sampled: 1
X-B3-Spanid: c6c0d4e855c06fba
X-B3-Traceid: 01bd1b82406ae9bac6c0d4e855c06fba
X-Envoy-Attempt-Count: 1
X-Envoy-Decorator-Operation: whoami-svc.gateway-test.svc.cluster.local:8080/*
X-Envoy-Internal: true
X-Envoy-Peer-Metadata: ChQKDkFQUF9DT05UQUlORVJTEgIaAAoaCgpDTFVTVEVSX0lEEgwaCkt1YmVybmV0ZXMKHQoMSU5TVEFOQ0VfSVBTEg0aCzEwLjQyLjAuMTEyChkKDUlTVElPX1ZFUlNJT04SCBoGMS4yMC4zCscBCgZMQUJFTFMSvAEquQEKKAoVaXN0aW8uaW8vZ2F0ZXdheS1uYW1lEg8aDWxvY2FsLWdhdGV3YXkKOAofc2VydmljZS5pc3Rpby5pby9jYW5vbmljYWwtbmFtZRIVGhNsb2NhbC1nYXRld2F5LWlzdGlvCi8KI3NlcnZpY2UuaXN0aW8uaW8vY2Fub25pY2FsLXJldmlzaW9uEggaBmxhdGVzdAoiChdzaWRlY2FyLmlzdGlvLmlvL2luamVjdBIHGgVmYWxzZQoaCgdNRVNIX0lEEg8aDWNsdXN0ZXIubG9jYWwKLQoETkFNRRIlGiNsb2NhbC1nYXRld2F5LWlzdGlvLWZiNzQ0N2Y0Ni1nNTZnbQobCglOQU1FU1BBQ0USDhoMaXN0aW8tc3lzdGVtClwKBU9XTkVSElMaUWt1YmVybmV0ZXM6Ly9hcGlzL2FwcHMvdjEvbmFtZXNwYWNlcy9pc3Rpby1zeXN0ZW0vZGVwbG95bWVudHMvbG9jYWwtZ2F0ZXdheS1pc3RpbwomCg1XT1JLTE9BRF9OQU1FEhUaE2xvY2FsLWdhdGV3YXktaXN0aW8=
X-Envoy-Peer-Metadata-Id: router~10.42.0.112~local-gateway-istio-fb7447f46-g56gm.istio-system~istio-system.svc.cluster.local
X-Forwarded-For: 10.42.0.1
X-Forwarded-Proto: https
X-Request-Id: 8a0960c0-4626-9a67-9114-61b365b274af
```

#### ReferenceGrant

上面的 `HTTPRoute` 和引用的后端服务在同一个命名空间中，如果不在同一个命名空间，就需要使用 `ReferenceGrant` 进行显示授权，`ReferenceGrant` 允许和它在同一个命名空间中的 `Service` 被其他命名空间中的 `HTTPRoute` 进行引用，对前面的示例进行改造然后进行演示，首先删除原来命名空间中的资源：

> `kubectl delete ns --cascade gateway-test`

然后重新创建下面的资源：

```
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: gateway-test
  labels:
    shared-gateway-access: "true"
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: whoami-http-route
  namespace: gateway-test
spec:
  parentRefs:
    - name: local-gateway
      namespace: istio-system
  hostnames:
    - "web.local.dev"
  rules:
    - matches:
      - path:
          type: PathPrefix
          value: /whoami
      backendRefs:
        - name: whoami-svc
          port: 8080
          namespace: gateway-test-svc
---
apiVersion: v1
kind: Namespace
metadata:
  name: gateway-test-svc
---
apiVersion: v1
kind: Service
metadata:
  name: whoami-svc
  namespace: gateway-test-svc
spec:
  ports:
    - port: 8080
      name: http
      targetPort: 80
  selector:
    app: whoami
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: whoami-deploy
  namespace: gateway-test-svc
  labels:
    app: whoami
spec:
  replicas: 1
  selector:
    matchLabels:
      app: whoami
  template:
    metadata:
      labels:
        app: whoami
    spec:
      containers:
      - name: whoami
        image: traefik/whoami
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 80
---
apiVersion: gateway.networking.k8s.io/v1beta1
kind: ReferenceGrant
metadata:
  name: ref-grant-to-svc
  namespace: gateway-test-svc
spec:
  from:
  - group: gateway.networking.k8s.io
    kind: HTTPRoute
    namespace: gateway-test
  to:
  - group: ""
    kind: Service
EOF
```

对上面的资源配置做以下解释：

1. `HTTPRoute` 依然在 `gateway-test` 命名空间中，是为了能让 `local-gateway` 接受此路由，而且它引用的`whoami-svc`目前被放在了`gateway-test-svc`中，通过 `namespace` 显示指定；
2. 为了能让 `gateway-test` 中的 `HTTPRoute` 引用 `gateway-test-svc` 的 `Service`，使用 `ReferenceGrant` 显示进行授权；

部署成功之后，使用下面的命令依然能够访问成功：

> `curl -i --resolve web.local.dev:9443:172.19.106.241 https://web.local.dev:9443/whoami`

#### 重定向

使用 `HTTPRoute` 还可完成重定向和路由重写功能。

##### 协议重定向

在 `HTTP` 协议中，经常会将不安全的`http`访问重定向到`https`协议，为了测试这个功能，首先对`local-gateway`进行更新，允许它处理来自`http`的报文：

```
kubectl apply -f - <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: local-gateway
  namespace: istio-system
spec:
  gatewayClassName: istio
  listeners:
    - protocol: HTTP
      port: 9080
      name: web-http-gw
      hostname: web.local.dev
      allowedRoutes:
        namespaces:
          from: Selector
          selector:
            matchLabels:
              shared-gateway-access: "true"
            matchExpressions:
              - key: kubernetes.io/metadata.name
                operator: In
                values:
                  - gateway-test
    - protocol: HTTPS
      port: 9443
      name: web-https-gw
      hostname: web.local.dev
      allowedRoutes:
        kinds:
          - kind: HTTPRoute
        namespaces:
          from: Selector
          selector:
            matchLabels:
              shared-gateway-access: "true"
            matchExpressions:
              - key: kubernetes.io/metadata.name
                operator: In
                values:
                  - gateway-test
      tls:
        mode: Terminate 
        certificateRefs:
          - name: web.local.dev-crt 
            kind: Secret  
            group: ""
EOF
```

这个更新让 `web.local.dev` 可以通过 `http` 和 `https` 两种协议进行访问。

{% tabs 协议重定向, 2 %}

<!-- tab 重定向之前-->

承接 `ReferenceGrant` 中的测试案例，这个时候可以使用`http`协议访问 `whoami` 服务：

> `curl -i --resolve web.local.dev:9080:172.19.106.241 http://web.local.dev:9080/whoami`

```
$ curl -i --resolve web.local.dev:9080:172.19.106.241 http://web.local.dev:9080/whoami
HTTP/1.1 200 OK
date: Sat, 02 Mar 2024 07:48:14 GMT
content-length: 1406
content-type: text/plain; charset=utf-8
x-envoy-upstream-service-time: 0
server: istio-envoy

Hostname: whoami-deploy-6cc79b7f7d-vjt2m
IP: 127.0.0.1
IP: 10.42.0.117
RemoteAddr: 10.42.0.112:48374
GET /whoami HTTP/1.1
Host: web.local.dev:9080
User-Agent: curl/7.81.0
Accept: */*
X-B3-Sampled: 1
X-B3-Spanid: e1708968da8fe32c
X-B3-Traceid: 715a2daabdb898c2e1708968da8fe32c
X-Envoy-Attempt-Count: 1
X-Envoy-Decorator-Operation: whoami-svc.gateway-test-svc.svc.cluster.local:8080/*
X-Envoy-Internal: true
X-Envoy-Peer-Metadata: ChQKDkFQUF9DT05UQUlORVJTEgIaAAoaCgpDTFVTVEVSX0lEEgwaCkt1YmVybmV0ZXMKHQoMSU5TVEFOQ0VfSVBTEg0aCzEwLjQyLjAuMTEyChkKDUlTVElPX1ZFUlNJT04SCBoGMS4yMC4zCscBCgZMQUJFTFMSvAEquQEKKAoVaXN0aW8uaW8vZ2F0ZXdheS1uYW1lEg8aDWxvY2FsLWdhdGV3YXkKOAofc2VydmljZS5pc3Rpby5pby9jYW5vbmljYWwtbmFtZRIVGhNsb2NhbC1nYXRld2F5LWlzdGlvCi8KI3NlcnZpY2UuaXN0aW8uaW8vY2Fub25pY2FsLXJldmlzaW9uEggaBmxhdGVzdAoiChdzaWRlY2FyLmlzdGlvLmlvL2luamVjdBIHGgVmYWxzZQoaCgdNRVNIX0lEEg8aDWNsdXN0ZXIubG9jYWwKLQoETkFNRRIlGiNsb2NhbC1nYXRld2F5LWlzdGlvLWZiNzQ0N2Y0Ni1nNTZnbQobCglOQU1FU1BBQ0USDhoMaXN0aW8tc3lzdGVtClwKBU9XTkVSElMaUWt1YmVybmV0ZXM6Ly9hcGlzL2FwcHMvdjEvbmFtZXNwYWNlcy9pc3Rpby1zeXN0ZW0vZGVwbG95bWVudHMvbG9jYWwtZ2F0ZXdheS1pc3RpbwomCg1XT1JLTE9BRF9OQU1FEhUaE2xvY2FsLWdhdGV3YXktaXN0aW8=
X-Envoy-Peer-Metadata-Id: router~10.42.0.112~local-gateway-istio-fb7447f46-g56gm.istio-system~istio-system.svc.cluster.local
X-Forwarded-For: 10.42.0.1
X-Forwarded-Proto: http
X-Request-Id: e55ee377-abff-93fd-a3e8-1162549b40ba
```

<!-- endtab -->

<!-- tab 重定向之后-->

如果想将所有的 `http` 访问全部重定向到 `https`，需要对 `gateway-test` 中的`HTTPRoute`进行更改，使用 `sectionName` 区分两个路由引用的协议，这样可以单独设置通过`http`协议访问时的动作：

```
kubectl apply -f - <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: whoami-http-route
  namespace: gateway-test
spec:
  parentRefs:
    - name: local-gateway
      namespace: istio-system
      sectionName: web-http-gw
  hostnames:
    - "web.local.dev"
  rules:
    - filters:
      - type: RequestRedirect
        requestRedirect:
          scheme: https
          port: 9443
          statusCode: 301
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: whoami-https-route
  namespace: gateway-test
spec:
  parentRefs:
    - name: local-gateway
      namespace: istio-system
      sectionName: web-https-gw
  hostnames:
    - "web.local.dev"
  rules:
    - matches:
      - path:
          type: PathPrefix
          value: /whoami
      backendRefs:
        - name: whoami-svc
          port: 8080
          namespace: gateway-test-svc
EOF
```

执行上面的操作之后，再次通过 `http` 协议进行访问，会发现已经重定向了：

```
$ curl -i --resolve web.local.dev:9080:172.19.106.241 http://web.local.dev:9080/whoami
HTTP/1.1 301 Moved Permanently
location: https://web.local.dev:9443/whoami
date: Sat, 02 Mar 2024 08:01:29 GMT
server: istio-envoy
content-length: 0
```

<!-- endtab -->

{% endtabs %}


##### 路径重定向

路径重定向使用 `HTTP` 路径修饰符来替换整个路径或路径前缀，如下所示：

```
kubectl apply -f - <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: whoami-https-route
  namespace: gateway-test
spec:
  parentRefs:
    - name: local-gateway
      namespace: istio-system
      sectionName: web-https-gw
  hostnames:
    - "web.local.dev"
  rules:
    - matches:
      - path:
          type: PathPrefix
          value: /whoami
      backendRefs:
        - name: whoami-svc
          port: 8080
          namespace: gateway-test-svc
    - matches:
      - path:
          type: PathPrefix
          value: /who
      filters:
        - type: RequestRedirect
          requestRedirect:
            path:
              type: ReplacePrefixMatch
              replacePrefixMatch: /whoami
            statusCode: 302
    - matches:
      - path:
          type: PathPrefix
          value: /whoam
      filters:
        - type: RequestRedirect
          requestRedirect:
            path:
              type: ReplaceFullPath
              replaceFullPath: /whoami
            statusCode: 302
EOF
```

然后当访问以 `/whamo` 开头的请求时都会被全部重定向到 `/whoami`：

```
$ curl -i --resolve web.local.dev:9443:172.19.106.241 https://web.local.dev:9443/whoam
HTTP/2 302
location: https://web.local.dev:9443/whoami
date: Sat, 02 Mar 2024 08:20:07 GMT
server: istio-envoy
$ curl -i --resolve web.local.dev:9443:172.19.106.241 https://web.local.dev:9443/whoam/xxx
HTTP/2 302
location: https://web.local.dev:9443/whoami
date: Sat, 02 Mar 2024 08:34:27 GMT
server: istio-envoy
```

当访问以 `/who` 开头的请求时，仅仅 `/who` 会被完全替换为 `/whoami`：

```
$ curl -i --resolve web.local.dev:9443:172.19.106.241 https://web.local.dev:9443/who/xxx
HTTP/2 302
location: https://web.local.dev:9443/whoami/xxx
date: Sat, 02 Mar 2024 08:35:48 GMT
server: istio-envoy

$ curl -i --resolve web.local.dev:9443:172.19.106.241 https://web.local.dev:9443/who
HTTP/2 302
location: https://web.local.dev:9443/whoami
date: Sat, 02 Mar 2024 08:35:52 GMT
server: istio-envoy
```

#### HTTP 头修改

通过 `HTTPRoute` 中的 `RequestHeaderModifier` 可以添加、修改或者删除请求头，例如下面的`HTTPRoute`中将对以`/whoami`开头的请求添加`request-with-correct-path: true` 这样的请求头：

```
kubectl apply -f - <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: whoami-https-route
  namespace: gateway-test
spec:
  parentRefs:
    - name: local-gateway
      namespace: istio-system
      sectionName: web-https-gw
  hostnames:
    - "web.local.dev"
  rules:
    - matches:
      - path:
          type: PathPrefix
          value: /whoami
      backendRefs:
        - name: whoami-svc
          port: 8080
          namespace: gateway-test-svc
      filters:
        - type: RequestHeaderModifier
          requestHeaderModifier:
            add:
              - name: request-with-correct-path
                value: "true"
    - matches:
      - path:
          type: PathPrefix
          value: /who
      filters:
        - type: RequestRedirect
          requestRedirect:
            path:
              type: ReplacePrefixMatch
              replacePrefixMatch: /whoami
            statusCode: 302
    - matches:
      - path:
          type: PathPrefix
          value: /whoam
      filters:
        - type: RequestRedirect
          requestRedirect:
            path:
              type: ReplaceFullPath
              replaceFullPath: /whoami
            statusCode: 302
EOF
```

当在请求的时候，会返回如下的结果：

```
$ curl -i --resolve web.local.dev:9443:172.19.106.241 https://web.local.dev:9443/whoami
HTTP/2 200
date: Sat, 02 Mar 2024 08:53:55 GMT
content-length: 1440
content-type: text/plain; charset=utf-8
x-envoy-upstream-service-time: 1
server: istio-envoy

Hostname: whoami-deploy-6cc79b7f7d-vjt2m
IP: 127.0.0.1
IP: 10.42.0.117
RemoteAddr: 10.42.0.112:57130
GET /whoami HTTP/1.1
Host: web.local.dev:9443
User-Agent: curl/7.81.0
Accept: */*
Request-With-Correct-Path: true
...
```

### 参考链接

1. https://www.nginx-cn.net/blog/5-things-to-know-about-nginx-kubernetes-gateway/