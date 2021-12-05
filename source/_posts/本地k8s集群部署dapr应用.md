---
title: 本地k8s集群部署dapr应用
date: 2021-12-05 21:25:38
tags:
    - dapr
    - k3d
    - k3s
    - k8s
    - traefik
    - rancher
    - helm
    - docker
categories:
    - dapr
---

[`Dapr`](https://dapr.io/) 在 2021 年发布了 v1.0 生产可用版本，预示着这个号称分布式运行时的框架终于可以进入各种大企业。说是尝鲜那已经是晚了很多，讲内部实现目前还不了解，本文主要是记录自己在本地创建 k8s 集群并且跑起来我第一个基于dapr应用的辛酸过程，辛酸是因为对k8s及dapr都不熟悉，加之国内网络限制，M1 芯片对某些软件不支持导致。

{% asset_img service-invocation.png dapr服务调用 %}

<!-- more -->

### 预装软件

在开始操作之前，我们需要安装很多软件，当然我相信大多数开发者已经装了大部分软件。


#### docker

首先自然是 [docker](https://www.docker.com/products/docker-desktop)，虽然不是容器技术的创造者，但容器技术的发扬光大，肯定有 docker 的功劳。docker 安装比较简单，在 MaxOS 上，直接下载 Desktop 版本即可。

#### k3d

[k3d](https://k3d.io/v5.0.0/) 是讲 [k3s](https://k3s.io/) 运行在 docker 中的社区软件，k3s 是轻量级的 k8s，主要部署于物联网设备，ARM 芯片设备上，耗电少体积小，易部署，我们在本地开发中想创建 k8s 集群，可以选择 k3d+k3s 的方式，当然也有 [minikube](https://link.juejin.cn/?target=https%3A%2F%2Fminikube.sigs.k8s.io%2Fdocs%2F)，[microk8s](https://link.juejin.cn/?target=https%3A%2F%2Fmicrok8s.io%2F)，[kind](https://link.juejin.cn/?target=https%3A%2F%2Fkind.sigs.k8s.io%2F) 等，我首选了 `minikube` + [multipass](https://multipass.run/) 的方式，奈何国内网络限制，加之 multipass 某些想要的功能 M1 还不支持，就放弃了。在 Mac 上安装 k3d 很简单：

> brew install k3d
> brew install kubectl
> brew install kubecm

#### helm

k8s 用于容器编排，但是如果手动通过 k8s API 管理集群，那是非常累的，所以有了 [helm](https://helm.sh/)，k8s 的包管理器，通过简单的命令就可以部署应用，MaxOS 上安装比较简单：

> brew install helm

#### dapr

今天的主角是 [dapr](https://docs.dapr.io/zh-hans/getting-started/install-dapr-cli/)，所以安装 dapr 也是必不可少的：

> brew install dapr/tap/dapr-cli

可能会遇到下载失败，编译失败，所以配置下 `GOPROXY`，有条件的话可以将 `https_proxy` 设置成可以科学上网的代理，加速下载。


### 创建k8s集群

本接创建 k8s 集群的方式参考自 [如何在本地快速启动一个 K8S 集群](https://juejin.cn/post/6940850465504493576)，执行一条命令：

> export CLUSTER_NAME="test-cluster" 
> k3d cluster create $CLUSTER_NAME --api-port 6550 --servers 1 --agents 1  --port 6443:443@loadbalancer --wait
> k3d cluster list

    $ k3d cluster list
    NAME           SERVERS   AGENTS   LOADBALANCER
    test-cluster   1/1       3/3      true

创建完成之后，会看到新建的集群已经就绪。

### 安装rancher

根据官网描述，[`Rancher`](https://rancher.com/docs/rancher/v2.6/en/) 是一个开源的企业级容器管理平台。通过Rancher，企业再也不必自己使用一系列的开源软件去从头搭建容器服务平台。Rancher提供了在生产环境中使用的管理Docker和Kubernetes的全栈化容器部署与管理平台。Rancher由以下四个部分组成：

- 基础设施编排
- 容器编排与调度
- 应用商店
- 企业级权限管理

安装 rancher 的过程很痛苦，失败了很多次，但是我还是要把它装好，最后总结起来就是以下的命令，最关键的就是等：

```shell

# 设置相应的环境变量
export RANCHER_SERVER_HOSTNAME="rancher.localhost"
export KUBECONFIG_FILE="${CLUSTER_NAME}.yaml"
k3d kubeconfig get $CLUSTER_NAME > $KUBECONFIG_FILE
export KUBECONFIG=$KUBECONFIG_FILE

# 安装 cer-manager 
helm repo add jetstack https://charts.jetstack.io
helm repo update
kubectl create namespace cert-manager
helm install cert-manager jetstack/cert-manager --namespace cert-manager --version v1.6.1 --set installCRDs=true --wait
kubectl -n cert-manager rollout status deploy/cert-manager
date

# 安装 Rancher
helm repo add rancher-latest https://releases.rancher.com/server-charts/latest
helm repo update
kubectl create namespace cattle-system
helm install rancher rancher-latest/rancher --namespace cattle-system --set hostname=${RANCHER_SERVER_HOSTNAME} --wait
kubectl -n cattle-system rollout status deploy/rancher
date
```

成功安装 Rancher 之后，登录到 rancher 后台，我们可以在后台安装我们想要的组件，例如：[prometheus](https://prometheus.io/)，[grafana](https://grafana.com/)等。

![](rancher-dashboard.png)

### 验证集群

作为测试我们创建一个nginx应用来验证我们的集群：

1. 创建包含一个 nginx 的 Deployment

> kubectl create deployment nginx --image=nginx

2. 创建Service，通过 ClusterIP 的方式暴露服务：

> kubectl create service clusterip nginx --tcp=80:80

3. 创建 Ingress，Ingress 会代理我们的入口流量给我们的service，k3s 默认安装的 ingress 是 [traefik 2.x](https://doc.traefik.io/traefik/routing/routers/#configuring-http-routers)，这里因为我不想把根目录直接暴露出去，每个服务都有一个前缀，例如到达 `nginx service` 的都得以 `/nginx` 开始，所以应该要有个路由重写的过程，最终采用中间件进行路由重写：

```
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nginx
  annotations:
    ingress.kubernetes.io/ssl-redirect: "false"
    traefik.ingress.kubernetes.io/router.middlewares: default-nginx-ingress-strip-prefix@kubernetescrd
spec:
  rules:
  - http:
      paths:
      - path: /nginx
        pathType: Prefix
        backend:
          service:
            name: nginx
            port:
              number: 80
---
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: nginx-ingress-strip-prefix
spec:
  stripPrefix:
    prefixes:
      - /nginx
EOF
```

安装 rancher 的好处就是能看得到，像我们刚才创建的 nginx Deployment，nginx Service，nginx Ingress以及 nginx-ingress-strip-prefix 中间件都可以在 Rancher 中观察到：

![nginx deployment](nginx-deployment.png)
![nginx service](nginx-service.png)
![nginx ingress](nginx-ingress.png)
![nginx middleware](nginx-middleware.png)


### 部署dapr应用

k8s集群中安装dapr，参考[添加和安装-dapr-helm-图表](https://docs.dapr.io/zh-hans/operations/hosting/kubernetes/kubernetes-deploy/#%E6%B7%BB%E5%8A%A0%E5%92%8C%E5%AE%89%E8%A3%85-dapr-helm-%E5%9B%BE%E8%A1%A8)，我使用下面的命令安装：

```
helm upgrade --install dapr dapr/dapr --version=1.5.1-rc.3 --namespace dapr-system --create-namespace --set global.mtls.enabled=false --wait 
```

将 dapr 的事例应用部署到我们的k8s集群中，这里我们部署他的 [`secretstore`](https://github.com/dapr/quickstarts/tree/v1.0.0/secretstore#run-in-kubernetes) 应用：

```
# clone 示例应用
git clone git@github.com:dapr/quickstarts.git
cd quickstarts

# 创建 secret
kubectl create secret generic mysecret --from-file ./mysecret

# 查看创建的 secret
$ kubectl get secret mysecret -o yaml

apiVersion: v1
data:
  mysecret: eHl6OTg3Ng==
kind: Secret
metadata:
  creationTimestamp: "2021-12-05T08:34:56Z"
  name: mysecret
  namespace: default
  resourceVersion: "34650"
  uid: b46d011e-4e91-4ce5-93c1-843bb272208e
type: Opaque

# 部署 nodeJs 写的 APP并且注入 Dapr sidecar
kubectl apply -f ./deploy/node.yaml
```

```yaml
# ./deploy/node.yaml
kind: Service
apiVersion: v1
metadata:
  name: nodeapp
  labels:
    app: node
spec:
  selector:
    app: node
  ports:
    - protocol: TCP
      port: 48080
      targetPort: 3000
  type: LoadBalancer

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nodeapp
  labels:
    app: node
spec:
  replicas: 1
  selector:
    matchLabels:
      app: node
  template:
    metadata:
      labels:
        app: node
      annotations:
        dapr.io/enabled: "true"
        dapr.io/app-id: "nodeapp"
        dapr.io/app-port: "3000"
    spec:
      containers:
        - name: node
          image: dapriosamples/secretstorenode:latest
          env:
            - name: SECRET_STORE
              value: "kubernetes"
          ports:
            - containerPort: 3000
          imagePullPolicy: Always
```

查看我们创建的service：

> $ kubectl get svc nodeapp


    NAME      TYPE           CLUSTER-IP     EXTERNAL-IP                        PORT(S)           AGE
    nodeapp   LoadBalancer   10.43.203.13   172.18.0.3,172.18.0.4,172.18.0.5   48080:31093/TCP   3h34m

为了能够访问到我们的服务，还必须创建一个 Ingress，像之前的 nginx service 那样，执行下面的命令：

```sh
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nodeapp
  annotations:
    ingress.kubernetes.io/ssl-redirect: "false"
    traefik.ingress.kubernetes.io/router.middlewares: default-nodeapp-ingress-strip-prefix@kubernetescrd
spec:
  rules:
  - http:
      paths:
      - path: /nodeapp
        pathType: Prefix
        backend:
          service:
            name: nodeapp
            port:
              number: 48080
---
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: nodeapp-ingress-strip-prefix
spec:
  stripPrefix:
    prefixes:
      - /nodeapp
EOF
```

验证我们的请求服务：

> $ curl -k  https://127.0.0.1:6443/nodeapp/getsecret


    eHl6OTg3Ng==

去我们的 nodeJs 应用查看日志，确认我们的请求被正确处理：

![nodeapp 日志](nodeapp-log.png)

可以再确认下我们的 Ingress：

![all ingress](all-ingress.png)


### 参考文章

1. [https://juejin.cn/post/6940850465504493576](https://juejin.cn/post/6940850465504493576)
