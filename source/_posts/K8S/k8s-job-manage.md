---
title: K8S 容器编排
date: 2024-01-10 15:37:54
tags:
    - pod
    - deployment
    - statefulset
    - replicaset
    - job
    - cronjob
    - daemonset
categories:
    - k8s
---

`Pod` 是`K8S`中的调度单位，它是一个逻辑概念，用于将一些关系密切的容器部署在一起提供对外服务，这些容器互相之间会发生直接的文件交换、使用`localhost`或者`Socket`文件进行本地通信、会发生非常频繁的远程调用、需要共享某些Linux Namespace等等，`Pod` 中的所有容器都共享同一个`Network Namespace`。`K8S` 中为了实现不同的目的，在`Pod`基础之上衍生出了不同的部署模型，例如，常见的 `Deployment`、`Replicaset`、以及`StatefulSet`等等，本文就来举例并且说明它们之间的区别。

### Pod

[Pod](https://kubernetes.io/zh-cn/docs/concepts/workloads/pods/) 这个看似复杂的API对象，实际上就是对容器的进一步抽象和封装而已，`Pod`对象，其实就是容器的升级版，它对容器进行了组合，添加了更多的属性和字段。依据[PodAPI](https://kubernetes.io/zh-cn/docs/reference/kubernetes-api/workload-resources/pod-v1/) 编写一个`Pod`模板，然后使用`kubectl`提交到集群中，这个`Pod`里面包含两个容器，`whoami`监听`80`端口，提供一个简单的服务返回主机名，`nettool` 是一个工具容器，提供了很多可用的网络工具供测试使用：

{% note success 点击查看 %}
```shell
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: whoami
  labels:
    app.kubernetes.io/part-of: whoami
    app.kubernetes.io/name: whoami
---
apiVersion: v1
kind: Pod
metadata:
  name: whoami
  namespace: whoami
  labels:
    app.kubernetes.io/part-of: whoami
    app.kubernetes.io/name: whoami
spec:
  containers:
  - name: whoami
    image: traefik/whoami
    imagePullPolicy: IfNotPresent
    ports:
    - containerPort: 80
  - name: nettool
    image: praqma/network-multitool
    imagePullPolicy: IfNotPresent
    command: ["sleep"]
    args: ["86400"]
EOF
```
{% endnote %}

执行之后，使用下面的命令查看创建成功的`Pod`：

```
$ kubectl get pods -n whoami -owide
NAME     READY   STATUS    RESTARTS   AGE   IP            NODE           NOMINATED NODE   READINESS GATES
whoami   2/2     Running   0          92s   10.42.0.221   ctrlnode       <none>           <none>
```

查看`Pod`中的容器：

```
$ kubectl get pods -n whoami whoami -o jsonpath={.spec.containers[*].name}
whoami nettool
```

进入`nettool`，通过`localhost`就能访问`whoami`容器中的服务，因为它们共享网络栈，在同一个网络空间内：

```
$ kubectl exec whoami -n whoami -it -c nettool -- /bin/bash
bash-5.1#
bash-5.1# netstat -tualnp | grep LISTEN
tcp6       0      0 :::80                   :::*                    LISTEN      -
bash-5.1# curl localhost
Hostname: whoami
IP: 127.0.0.1
IP: 10.42.0.221
RemoteAddr: 127.0.0.1:34488
GET / HTTP/1.1
Host: localhost
User-Agent: curl/7.79.1
Accept: */*

bash-5.1#
```

测试环境中使用`docker`作为容器运行时，查看`Pod`中的容器时，会存在一个`pause`容器，它使用的是一个非常特殊的镜像，叫作：`k8s.gcr.io/pause`，这个镜像是一个用汇编语言编写的、永远处于暂停状态的容器，解压后的大小也只有100~200 KB左右。在这`Pause`容器启动之后，`Pod`中的其他容器就可以加入这个`Pause`容器的命名空间，从而实现共享，但是`mnt`、`pid`以及`uts`这三个命名空间默认不共享，`pid`可以通过`spec.shareProcessNamespace`单独设置：

```
$ docker ps | grep whoami
52d2b3478c88        1631e536ed7d                 "sleep 86400"            15 minutes ago      Up 15 minutes                           k8s_nettool_whoami_whoami_..
089341cdc151        e21a57f872ce                 "/whoami"                15 minutes ago      Up 15 minutes                           k8s_whoami_whoami_whoami_..
0bd146217958        rancher/mirrored-pause:3.6   "/pause"                 15 minutes ago      Up 15 minutes                           k8s_POD_whoami_whoami_..
$ ll /proc/"$(docker inspect --format "{{ .State.Pid }}" 52d2b3478c88)"/ns
total 0
dr-x--x--x 2 root root 0 Jan 11 20:16 ./
dr-xr-xr-x 9 root root 0 Jan 11 20:11 ../
lrwxrwxrwx 1 root root 0 Jan 11 20:28 cgroup -> 'cgroup:[4026531835]'
lrwxrwxrwx 1 root root 0 Jan 11 20:16 ipc -> 'ipc:[4026533554]'
lrwxrwxrwx 1 root root 0 Jan 11 20:16 mnt -> 'mnt:[4026533901]'
lrwxrwxrwx 1 root root 0 Jan 11 20:16 net -> 'net:[4026533557]'
lrwxrwxrwx 1 root root 0 Jan 11 20:16 pid -> 'pid:[4026533903]'
lrwxrwxrwx 1 root root 0 Jan 11 20:28 pid_for_children -> 'pid:[4026533903]'
lrwxrwxrwx 1 root root 0 Jan 11 20:28 user -> 'user:[4026531837]'
lrwxrwxrwx 1 root root 0 Jan 11 20:16 uts -> 'uts:[4026533902]'
$ ll /proc/"$(docker inspect --format "{{ .State.Pid }}" 089341cdc151)"/ns
total 0
dr-x--x--x 2 root root 0 Jan 11 20:28 ./
dr-xr-xr-x 9 root root 0 Jan 11 20:11 ../
lrwxrwxrwx 1 root root 0 Jan 11 20:29 cgroup -> 'cgroup:[4026531835]'
lrwxrwxrwx 1 root root 0 Jan 11 20:29 ipc -> 'ipc:[4026533554]'
lrwxrwxrwx 1 root root 0 Jan 11 20:29 mnt -> 'mnt:[4026533778]'
lrwxrwxrwx 1 root root 0 Jan 11 20:28 net -> 'net:[4026533557]'
lrwxrwxrwx 1 root root 0 Jan 11 20:29 pid -> 'pid:[4026533780]'
lrwxrwxrwx 1 root root 0 Jan 11 20:29 pid_for_children -> 'pid:[4026533780]'
lrwxrwxrwx 1 root root 0 Jan 11 20:29 user -> 'user:[4026531837]'
lrwxrwxrwx 1 root root 0 Jan 11 20:29 uts -> 'uts:[4026533779]'
$ ll /proc/"$(docker inspect --format "{{ .State.Pid }}" 0bd146217958)"/ns
total 0
dr-x--x--x 2 65535 65535 0 Jan 11 20:11 ./
dr-xr-xr-x 9 65535 65535 0 Jan 11 20:11 ../
lrwxrwxrwx 1 65535 65535 0 Jan 11 20:41 cgroup -> 'cgroup:[4026531835]'
lrwxrwxrwx 1 65535 65535 0 Jan 11 20:11 ipc -> 'ipc:[4026533554]'
lrwxrwxrwx 1 65535 65535 0 Jan 11 20:41 mnt -> 'mnt:[4026533552]'
lrwxrwxrwx 1 65535 65535 0 Jan 11 20:11 net -> 'net:[4026533557]'
lrwxrwxrwx 1 65535 65535 0 Jan 11 20:41 pid -> 'pid:[4026533555]'
lrwxrwxrwx 1 65535 65535 0 Jan 11 20:41 pid_for_children -> 'pid:[4026533555]'
lrwxrwxrwx 1 65535 65535 0 Jan 11 20:41 user -> 'user:[4026531837]'
lrwxrwxrwx 1 65535 65535 0 Jan 11 20:41 uts -> 'uts:[4026533553]'
```

清理现场使用下面的命令：

>  kubectl delete ns --cascade whoami

### ReplicaSet

`Pod` 将具有亲密关系的容器部署在同一个盒子中，统一对外提供服务，但是当流量较多的时候，单个`Pod`就无法支撑，这个时候就需要多个实例，这正是`ReplicaSet`的意义，为`Pod`提供多实例部署，根据需要实现水平扩缩容。下面是一个`ReplicaSet`对象的示例：

{% note success 点击展开 %}
```shell
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: rs
  labels:
    app.kubernetes.io/part-of: nginx-rs
    app.kubernetes.io/name: nginx-rs
---
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: nginx-rs
  namespace: rs
  labels:
    app: nginx
    app.kubernetes.io/part-of: nginx-rs
    app.kubernetes.io/name: nginx-rs
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.14.1
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 80
      - name: nettool
        image: praqma/network-multitool
        imagePullPolicy: IfNotPresent
        command: ["sleep"]
        args: ["86400"]
EOF
```
{% endnote %}

相较于`Pod`，`ReplicaSet` 增加了一些字段：

- `.spec.replicas` 表示这个 `ReplicaSet` 对象的副本个数，会将匹配的`Pod`扩展到这个数量；
- `.spec.selector.matchLabels` 用于匹配根据标签`Pod`，表示这个`ReplicaSet`对象要作用到哪些`Pod`上；
- `.spec.template` 是一个完整的`Pod`模板，用于描述这个`ReplicaSet`管理的`Pod`，其中`.spec.template.metadata.labels` 用于给`Pod`打标签，通常它至少包含`.spec.selector.matchLabels`，这样`ReplicaSet`的策略才能作用到这个`Pod`，`.spec.template.spec.containers` 就是用来描述`Pod`中的容器；

执行上面的命令之后，查看新建的的`Pod` 和 `ReplicaSet` 对象，这3个不同的`Pod`表示不同的副本：

```
$ kubectl get pods,rs -n rs -owide
NAME                 READY   STATUS    RESTARTS   AGE   IP            NODE           NOMINATED NODE   READINESS GATES
pod/nginx-rs-fgsmp   2/2     Running   0          11m   10.42.0.227   node1         <none>           <none>
pod/nginx-rs-5qrm6   2/2     Running   0          11m   10.42.0.226   node1         <none>           <none>
pod/nginx-rs-zz74s   2/2     Running   0          11m   10.42.0.225   node1         <none>           <none>

NAME                       DESIRED   CURRENT   READY   AGE   CONTAINERS      IMAGES                                  SELECTOR
replicaset.apps/nginx-rs   3         3         3       11m   nginx,nettool   nginx:1.14.1,praqma/network-multitool   app=nginx
```

在 `rs` 的输出中，`DESIRED` 表示期望的副本数量，`CURRENT` 表示当前处于 `Running` 状态的数量，`READY` 表示既是 `Running` 又健康检查ok的数量，关于健康检查请看[这里](https://kubernetes.io/zh-cn/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)。清理现场使用下面的命令：

>  kubectl delete ns --cascade rs

### Deployment

通常情况下，我们在生产环境不会直接使用 `ReplicaSet`，因为它不支持滚动更新，所谓的滚动更新就是当我们升级`Pod`的时候，可以在不中断服务的情况下，通过交替升级的方式，让所有的`Pod`都达到最新的状态，除此之外还可以实现版本控制，根据需要回滚到具体的版本，这些操作对于 `ReplicaSet` 就得手动操作。下面是一个[Deployment](https://kubernetes.io/zh-cn/docs/concepts/workloads/controllers/deployment/)的示例：

{% note success 点击展开 %}
```shell
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: deploy-test
  labels:
    app.kubernetes.io/part-of: nginx-deploy
    app.kubernetes.io/name: nginx-deploy
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deploy
  namespace: deploy-test
  labels:
    app: nginx
    app.kubernetes.io/part-of: nginx-deploy
    app.kubernetes.io/name: nginx-deploy
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.14.1
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 80
      - name: nettool
        image: praqma/network-multitool
        imagePullPolicy: IfNotPresent
        command: ["sleep"]
        args: ["86400"]
EOF
```
{% endnote %}

相比 `ReplicaSet`，主要增加了 `.spec.strategy` 字段，其中：

- `.spec.strategy.type`，表示`Pod`更新时的策略，默认是`RollingUpdate`，表示滚动更新，如果取值 `Recreate`，它会直接将老的`Pod`停止，再创建新的`Pod`；
- `.spec.strategy.rollingUpdate`，表示滚动更新时的策略：
    - `maxUnavailable`，它是一个可选字段，用来指定更新过程中不可用的`Pod`的个数上限。该值可以是绝对数字（例如，`5`），也可以是所需 `Pod` 的百分比（例如，`10%`）。百分比值会转换成绝对数并去除小数部分。 如果 `maxSurge` 为 `0`，则此值不能为 `0`。 默认值为 `25%`。例如，当此值设置为`30%`时，滚动更新开始时会立即将旧`ReplicaSet`缩容到期望`Pod`个数的`70%`。新`Pod`准备就绪后，可以继续缩容旧有的`ReplicaSet`，然后对新的`ReplicaSet`扩容，确保在更新期间可用的`Pod`总数在任何时候都至少为所需的`Pod`个数的`70%`。
    - `maxSurge`，是一个可选字段，用来指定可以创建的超出期望`Pod`个数的`Pod`数量。此值可以是绝对数（例如，`5`）或所需`Pod`的百分比（例如，`10%`）。如果`MaxUnavailable`为`0`，则此值不能为`0`。百分比值会通过向上取整转换为绝对数。此字段的默认值为`25%`。例如，当此值为`30%`时，启动滚动更新后，会立即对新的`ReplicaSet`扩容，同时保证新旧`Pod`的总数不超过所需`Pod`总数的`130%`。一旦旧`Pod`被杀死，新的`ReplicaSet`可以进一步扩容，同时确保更新期间的任何时候运行中的`Pod`总数最多为所需`Pod`总数的`130%`。

执行上面的部署命令之后，查询`pod`、`rs`以及`deployment`的状态如下所示：

> `kubectl get pod,rs,deploy -n deploy-test -owide`

```
$ kubectl get pod,rs,deploy -n deploy-test -owide
NAME                                READY   STATUS    RESTARTS   AGE   IP            NODE           NOMINATED NODE   READINESS GATES
pod/nginx-deploy-6b5d947665-7hjsk   2/2     Running   0          7s    10.42.0.233   node           <none>           <none>
pod/nginx-deploy-6b5d947665-xlz2q   2/2     Running   0          7s    10.42.0.232   node           <none>           <none>
pod/nginx-deploy-6b5d947665-nqmwq   2/2     Running   0          7s    10.42.0.231   node           <none>           <none>

NAME                                      DESIRED   CURRENT   READY   AGE   CONTAINERS      IMAGES                                  SELECTOR
replicaset.apps/nginx-deploy-6b5d947665   3         3         3       7s    nginx,nettool   nginx:1.14.1,praqma/network-multitool   app=nginx,pod-template-hash=6b5d947665

NAME                           READY   UP-TO-DATE   AVAILABLE   AGE   CONTAINERS      IMAGES                                  SELECTOR
deployment.apps/nginx-deploy   3/3     3            3           7s    nginx,nettool   nginx:1.14.1,praqma/network-multitool   app=nginx
```

从这可以看到，`Deployment` 通过控制 `ReplicaSet`来满足`Pod` 数量的要求，相比`ReplicaSet`增加了以下字段：

- `UP-TO-DATE`：表示当前处于最新版本的`Pod`数量，所谓最新版本指的是`Pod`的`Spec`部分与`Deployment`里`Pod`模板里定义的完全一致；
- `AVAILABLE`：当前已经可用的`Pod`的个数，即：既是`Running`状态，又是最新版本，并且已经处于`Ready`（健康检查正确）状态的Pod的个数；

#### 更新

使用下面的命令更新`Pod`：

> `kubectl set image -n deploy-test deployment/nginx-deploy nginx=nginx:1.16.1`

执行结束之后，查询`pod`、`rs`以及`deployment`的状态如下所示：

```
$ kubectl get pod,rs,deploy -n deploy-test -owide
NAME                                READY   STATUS    RESTARTS   AGE    IP            NODE           NOMINATED NODE   READINESS GATES
pod/nginx-deploy-5dd86f689f-xnlqr   2/2     Running   0          107s   10.42.0.235   node                 <none>           <none>
pod/nginx-deploy-5dd86f689f-9ksq8   2/2     Running   0          106s   10.42.0.236   node                 <none>           <none>
pod/nginx-deploy-5dd86f689f-97x22   2/2     Running   0          107s   10.42.0.234   node                 <none>           <none>

NAME                                      DESIRED   CURRENT   READY   AGE     CONTAINERS      IMAGES                                  SELECTOR
replicaset.apps/nginx-deploy-5dd86f689f   3         3         3       107s    nginx,nettool   nginx:1.16.1,praqma/network-multitool   app=nginx,pod-template-hash=5dd86f689f
replicaset.apps/nginx-deploy-6b5d947665   0         0         0       5m39s   nginx,nettool   nginx:1.14.1,praqma/network-multitool   app=nginx,pod-template-hash=6b5d947665

NAME                           READY   UP-TO-DATE   AVAILABLE   AGE     CONTAINERS      IMAGES                                  SELECTOR
deployment.apps/nginx-deploy   3/3     3            3           5m39s   nginx,nettool   nginx:1.16.1,praqma/network-multitool   app=nginx
```

可以看到旧的`nginx-deploy-6b5d947665`已经被缩容至`0`个`Pod`，新建的`nginx-deploy-5dd86f689f`被扩容至`3`个`Pod`。通过查看`nginx-deploy`的详情，可以看到滚动更新的过程：

>  kubectl describe deploy -n deploy-test nginx-deploy

```
# kubectl describe deploy -n deploy-test nginx-deploy
Name:                   nginx-deploy
Namespace:              deploy-test
CreationTimestamp:      Fri, 12 Jan 2024 15:49:26 +0800
Labels:                 app=nginx
                        app.kubernetes.io/name=nginx-deploy
                        app.kubernetes.io/part-of=nginx-deploy
Annotations:            deployment.kubernetes.io/revision: 2
Selector:               app=nginx
Replicas:               3 desired | 3 updated | 3 total | 3 available | 0 unavailable
StrategyType:           RollingUpdate
MinReadySeconds:        0
RollingUpdateStrategy:  1 max unavailable, 1 max surge
Pod Template:
   ....
OldReplicaSets:  nginx-deploy-6b5d947665 (0/0 replicas created)
NewReplicaSet:   nginx-deploy-5dd86f689f (3/3 replicas created)
Events:
  Type    Reason             Age    From                   Message
  ----    ------             ----   ----                   -------
  Normal  ScalingReplicaSet  9m26s  deployment-controller  Scaled up replica set nginx-deploy-6b5d947665 to 3
  Normal  ScalingReplicaSet  5m34s  deployment-controller  Scaled up replica set nginx-deploy-5dd86f689f to 1
  Normal  ScalingReplicaSet  5m34s  deployment-controller  Scaled down replica set nginx-deploy-6b5d947665 to 2 from 3
  Normal  ScalingReplicaSet  5m34s  deployment-controller  Scaled up replica set nginx-deploy-5dd86f689f to 2 from 1
  Normal  ScalingReplicaSet  5m33s  deployment-controller  Scaled down replica set nginx-deploy-6b5d947665 to 1 from 2
  Normal  ScalingReplicaSet  5m33s  deployment-controller  Scaled up replica set nginx-deploy-5dd86f689f to 3 from 2
  Normal  ScalingReplicaSet  5m32s  deployment-controller  Scaled down replica set nginx-deploy-6b5d947665 to 0 from 1
```

滚动更新过程中可以使用下面的命令查看滚动更新的过程：

> kubectl rollout status -n deploy-test deployment/nginx-deploy

```
$ kubectl rollout status -n deploy-test deployment/nginx-deploy
deployment "nginx-deploy" successfully rolled out
```

滚动更新的历史可以使用下面的命令查看：

> ` kubectl rollout history -n deploy-test deployment/nginx-deploy`

```
$ kubectl rollout history -n deploy-test deployment/nginx-deploy
deployment.apps/nginx-deploy
REVISION  CHANGE-CAUSE
1         <none>
2         <none>
```

#### 回滚

当更新出错，或者需要回滚到历史版本的时候，可以使用下面的命令进行操作，`--to-revision`指定目标历史版本：

> kubectl rollout undo -n deploy-test deployment/nginx-deploy --to-revision=1

```
$ kubectl rollout undo -n deploy-test deployment/nginx-deploy --to-revision=1
deployment.apps/nginx-deploy rolled back
```

#### 缩放

可以使用下面的命令对`Deployment` 进行扩缩容：

> kubectl scale deployment/nginx-deploy -n deploy-test --replicas=5

```
$ kubectl scale deployment/nginx-deploy -n deploy-test --replicas=5
deployment.apps/nginx-deploy scaled
$ kubectl get pod,rs,deploy -n deploy-test -owide
NAME                                READY   STATUS    RESTARTS   AGE     IP            NODE           NOMINATED NODE   READINESS GATES
pod/nginx-deploy-6b5d947665-kw88l   2/2     Running   0          7m21s   10.42.0.237   node                 <none>           <none>
pod/nginx-deploy-6b5d947665-69gvd   2/2     Running   0          7m21s   10.42.0.238   node                 <none>           <none>
pod/nginx-deploy-6b5d947665-m4lkz   2/2     Running   0          7m19s   10.42.0.239   node                 <none>           <none>
pod/nginx-deploy-6b5d947665-bwf5k   2/2     Running   0          18s     10.42.0.241   node                 <none>           <none>
pod/nginx-deploy-6b5d947665-snpzr   2/2     Running   0          18s     10.42.0.240   node                 <none>           <none>

NAME                                      DESIRED   CURRENT   READY   AGE   CONTAINERS      IMAGES                                  SELECTOR
replicaset.apps/nginx-deploy-5dd86f689f   0         0         0       23m   nginx,nettool   nginx:1.16.1,praqma/network-multitool   app=nginx,pod-template-hash=5dd86f689f
replicaset.apps/nginx-deploy-6b5d947665   5         5         5       27m   nginx,nettool   nginx:1.14.1,praqma/network-multitool   app=nginx,pod-template-hash=6b5d947665

NAME                           READY   UP-TO-DATE   AVAILABLE   AGE   CONTAINERS      IMAGES                                  SELECTOR
deployment.apps/nginx-deploy   5/5     5            5           27m   nginx,nettool   nginx:1.14.1,praqma/network-multitool   app=nginx
```

### StatefulSet

在`Deployment`中，我们认为所有`Pod`是完全一样的。所以，它们互相之间没有顺序，也无所谓运行在哪台宿主机上。需要的时候，`Deployment`就可以通过`Pod`模板创建新的`Pod`；不需要的时候，`Deployment`就可以杀掉任意一个`Pod`。但是，在实际的场景中，并不是所有的应用都可以满足这样的要求。尤其是分布式应用，它的多个实例之间，往往有依赖关系，比如：主从关系、主备关系。还有就是数据存储类应用，它的多个实例，往往都会在本地磁盘上保存一份数据。而这些实例一旦被杀掉，即便重建出来，实例与数据之间的对应关系也已经丢失，从而导致应用失败。所以，这种实例之间有不对等关系，以及实例对外部数据有依赖关系的应用，就被称为有状态应用（Stateful Application）。`Kubernetes`项目很早就在`Deployment`的基础上，扩展出了对有状态应用的初步支持，这个编排功能，就是：[StatefulSet](https://kubernetes.io/zh-cn/docs/concepts/workloads/controllers/statefulset/)，它给我们提供了：稳定的、唯一的网络标识符，稳定的、持久的存储，有序的、优雅的部署和扩缩，有序的、自动的滚动更新。

#### 网络持久化

先来看下网络持久化是怎么做到的，下面是用来验证的示例：

{% note success 点击展开 %}
```
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: sts-test
  labels:
    app.kubernetes.io/part-of: nginx-sts
    app.kubernetes.io/name: nginx-sts
---
apiVersion: v1
kind: Service
metadata:
  name: nginx
  namespace: sts-test
  labels:
    app: nginx
spec:
  ports:
  - port: 80
    name: web
  clusterIP: None
  selector:
    app: nginx
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: nginx-sts
  namespace: sts-test
  labels:
    app: nginx
    app.kubernetes.io/part-of: nginx-sts
    app.kubernetes.io/name: nginx-sts
spec:
  replicas: 3
  serviceName: "nginx"
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.14.1
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 80
      - name: nettool
        image: praqma/network-multitool
        imagePullPolicy: IfNotPresent
        command: ["sleep"]
        args: ["86400"]
EOF
```
{% endnote %}

### 参考链接

1. [Understanding ReplicaSet vs. StatefulSet vs. DaemonSet vs. Deployments](https://semaphoreci.com/blog/replicaset-statefulset-daemonset-deployments)
2. [Kubernetes Service Account: What It Is and How to Use It](https://loft.sh/blog/kubernetes-service-account-what-it-is-and-how-to-use-it/)
3. [节点亲和性和反亲和性部署](https://www.xiaowu95.wang/posts/90513b00/#node%E8%8A%82%E7%82%B9%E4%BA%B2%E5%92%8C%E6%80%A7)