---
title: K8S 数据挂载
date: 2024-01-17 10:32:22
tags:
    - Secret
    - ConfigMap
    - Downward API
    - ServiceAccountToken
    - 持久卷
    - 投射卷
    - 临时卷
categories:
    - k8s
---

`Pod`中的容器它里面的文件在磁盘上是临时存放的，当容器崩溃或停止时，`kubelet` 会以干净的状态重新启动容器，在容器生命周期内创建或修改的所有文件都将丢失。另外`Pod`在运行期间，需要为它注入一些必要的配置信息，以满足其运行。在这些场景的要求下，[卷](https://kubernetes.io/zh-cn/docs/concepts/storage/volumes/) 就应需而生，为了持久化存放容器里的数据，为容器运行提供配置。所有这些卷可以分为3类：

- `持久卷（Persistent Volume）`：和节点一样，属于集群资源，可以由管理员事先制备，或者使用存储类来动态制备，使用时通过`PVC`申请，就像其名字表述的一样，为了持久化数据；
- `投射卷（Projected Volumes）`：为`Pod`运行注入必要的配置信息；
- `临时卷（Ephemeral Volume）`：应用程序需要额外的存储，但并不关心数据在重启后是否仍然可用，随Pod而生，随Pod而灭。例如，`Redis`缓存服务经常受限于内存大小，而且可以将不常用的数据转移到比内存慢的存储中，对总体性能的影响并不大；

这些卷以及它们的分类、涉及的概念如下：

{% mermaid mindmap %}
卷
    投射卷
        Secret
        DownwardAPI
        Configmap
        ServiceAccountToken
    持久卷
        PV
        PVC
        StorageClass
    临时卷
        emptyDir
        CSI 临时卷
        通用临时卷
{% endmermaid %}


<!-- more -->

### Secret

[Secret](https://kubernetes.io/zh-cn/docs/concepts/configuration/secret/) 是一种包含少量敏感信息例如密码、令牌或密钥的对象，通过 `Secret` 我们就不用将一些机密数据硬编码到代码中了。`K8S`提供了一些内置的`Secret`类型，并且针对其中某些类型专门提供了`kubectl`命令进行管理，不同的类型对数据有不同的要求。

#### Opaque

可以直接从命令创建创建任意数据的`Secret`，首先创建命名空间用于测试：

> `kubectl create ns secret-test`

然后使用`kubectl`创建`Secret`：

> `kubectl -n secret-test create secret generic db-user-pass --from-literal=username=admin --from-literal=password='S!B\*d$zDsb='`

或者从文件创建，默认键名为文件名，也可以自定义：

> `echo -n 'admin' > ./username.txt`
> `echo -n 'S!B\*d$zDsb=' > ./password.txt`
> `kubectl -n secret-test create secret generic db-user-pass-v1 --from-file=./username.txt --from-file=./password.txt`
>
> `kubectl -n secret-test create secret generic db-user-pass-v2 --from-file=user=./username.txt --from-file=pass=./password.txt`

也可以使用`Yaml`文件组织`Secret`对象，这个对象中的`data`字段内容必须使用`base64`编码，如果想提供明文数据，则需要将其写入`stringData`字段中。首先使用 `base64` 编码数据，``：

```shell
$ echo -n "admin" | base64
YWRtaW4=
$ echo -n "123456" | base64
MTIzNDU2
```

然后使用下面的对象提交`Secret`

```shell
kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: db-user-pass-v3
  namespace: secret-test
type: Opaque
data:
  user: YWRtaW4=
  pass: MTIzNDU2
EOF
```

查看已经创建的`Secret`对象：

```
$ kubectl get secret -n secret-test
NAME              TYPE     DATA   AGE
db-user-pass      Opaque   2      12m
db-user-pass-v1   Opaque   2      7m18s
db-user-pass-v2   Opaque   2      5m50s
db-user-pass-v3   Opaque   2      57s
```

然后将创建的`Secret`挂载到`Pod`中，`Secret`不仅可以挂载到容器中的目录，还可以绑定到环境变量中：

```
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: nettool
  namespace: secret-test
spec:
  containers:
    - name: nettool
      image: praqma/network-multitool
      imagePullPolicy: IfNotPresent
      command: ["sleep"]
      args: ["86400"]
      volumeMounts:
        - name: db-user-pass
          mountPath: "/run/db-user-pass"
          readOnly: true
        - name: db-user-pass-v1-to-v3
          mountPath: "/run/db-user-pass-v1-to-v3"
          readOnly: true
      env:
        - name: DB_USER_NAME
          valueFrom:
            secretKeyRef:
              name: db-user-pass-v3
              key: user
        - name: DB_USER_PASS
          valueFrom:
            secretKeyRef:
              name: db-user-pass-v3
              key: pass
  volumes:
    - name: db-user-pass
      secret:
        secretName: db-user-pass
    - name: db-user-pass-v1-to-v3
      projected:
        sources:
          - secret:
             name: db-user-pass-v1
             items:
               - key: username.txt
                 path: v1/username
          - secret:
             name: db-user-pass-v2
             items:
               - key: pass
                 path: v2/pass
          - secret:
             name: db-user-pass-v3
             items:
               - key: user
                 path: v3/user
               - key: pass
                 path: v3/pass
EOF
```

执行命令进入到容器查看挂载的密码文件：

```
$ kubectl exec nettool -n secret-test -it -c nettool -- /bin/bash
bash-5.1# alias ll="ls -alh"
bash-5.1# cat /run/db-user-pass/username
admin
bash-5.1# cat /run/db-user-pass/password
S!B\*d$zDsb=
bash-5.1# cat /run/db-user-pass-v1-to-v3/v1/username
admin
bash-5.1# cat /run/db-user-pass-v1-to-v3/v2/pass
S!B\*d$zDsb=
bash-5.1# cat /run/db-user-pass-v1-to-v3/v3/user
admin
bash-5.1# cat /run/db-user-pass-v1-to-v3/v3/pass
123456
bash-5.1# env | grep DB_USER
DB_USER_NAME=admin
DB_USER_PASS=123456
```

#### 基本身份认证

`kubernetes.io/basic-auth` 类型用来存放用于基本身份认证所需的凭据信息。 使用这种 `Secret` 类型时，`Secret` 的 `data` 字段必须包含以下两个键之一：

- `username`: 用于身份认证的用户名；
- `password`: 用于身份认证的密码或令牌。

以上两个键的键值都是 `base64` 编码的字符串。 当然你也可以使用 `stringData` 字段来提供明文形式的内容：

```shell
kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: secret-basic-auth
  namespace: secret-test
type: kubernetes.io/basic-auth
data:
  user: YWRtaW4=
  pass: MTIzNDU2
stringData:
  username: admin
  password: t0p-Secret
EOF
```

不过`StringData`字段的内容只是作为输入，它会被编码合并到`data`字段中，而且通过`kubectl`命令是无法查看到明文，所以查看上面的对象，可以看到`data`中有`4`个字段：

```
$ kubectl describe secret -n secret-test secret-basic-auth
Name:         secret-basic-auth
Namespace:    secret-test
Labels:       <none>
Annotations:  <none>

Type:  kubernetes.io/basic-auth

Data
====
username:  5 bytes
pass:      6 bytes
password:  10 bytes
user:      5 bytes
```

#### SSH 身份认证 Secret

`kubernetes.io/ssh-auth` 用来存放 `SSH` 身份认证中所需要的凭据。 使用这种 `Secret` 类型时，必须在其 `data` （或 `stringData`）字段中提供一个 `ssh-privatekey` 键值对。如下所示，创建 `Secret` 并且绑定到容器中：

```
kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: secret-ssh-auth
  namespace: secret-test
type: kubernetes.io/ssh-auth
stringData:
  ssh-privatekey: |
    -----BEGIN OPENSSH PRIVATE KEY-----
    b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABlwAAAAdzc2gtcn
    ...
    Cy+8IKMq7Has21UTY/hw+3BHe6GtoIEx7uuyqMJTOaGmzBvu5MOp+tE4xRNd3D6bn3/P++
    0qD3uLsedBZBMAAAARcm9vdEBGMDA1OTYxMDctUFgBAg==
    -----END OPENSSH PRIVATE KEY-----
---
apiVersion: v1
kind: Pod
metadata:
  name: nettool-ssh
  namespace: secret-test
spec:
  containers:
    - name: nettool
      image: praqma/network-multitool
      imagePullPolicy: IfNotPresent
      command: ["sleep"]
      args: ["86400"]
      volumeMounts:
        - name: secret-ssh-auth
          mountPath: "/root/.ssh"
          readOnly: true
  volumes:
    - name: secret-ssh-auth
      secret:
        secretName: secret-ssh-auth
        items:
          - key: ssh-privatekey
            path: id_rsa 
EOF
```

进入到容器中进行验证：

```
$ kubectl exec nettool-ssh -n secret-test -it -c nettool -- /bin/bash
bash-5.1# cat /root/.ssh/id_rsa
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABlwAAAAdzc2gtcn
...
Cy+8IKMq7Has21UTY/hw+3BHe6GtoIEx7uuyqMJTOaGmzBvu5MOp+tE4xRNd3D6bn3/P++
0qD3uLsedBZBMAAAARcm9vdEBGMDA1OTYxMDctUFgBAg==
-----END OPENSSH PRIVATE KEY-----
bash-5.1#
```

#### TLS Secret

`kubernetes.io/tls` `Secret` 类型用来存放 `TLS` 场合通常要使用的证书及其相关密钥。当使用此类型的 `Secret` 时，`Secret` 配置中的 `data` （或 `stringData`）字段必须包含 `tls.key` 和 `tls.crt` 主键，而且可以通过`kubectl`命令直接创建`tls`类型的`Secret`。下面演示使用 [mkcert](https://github.com/FiloSottile/mkcert) 来生成证书，如果本地没有安装`go`，可以下载它的预编译版本：

```
$ go install filippo.io/mkcert@latest
$ mkcert -key-file key.pem -cert-file cert.pem svc.local.cluster *.svc.local.cluster
$ kubectl -n secret-test create secret tls my-tls-secret --cert=cert.pem --key=key.pem
$ kubectl describe secret -n secret-test my-tls-secret
Name:         my-tls-secret
Namespace:    secret-test
Labels:       <none>
Annotations:  <none>

Type:  kubernetes.io/tls

Data
====
tls.key:  1708 bytes
tls.crt:  1505 bytes
```

#### 清理现场

清理现场使用如下命令：

> `kubectl delete ns --cascade secret-test`

### ConfigMap

[ConfigMap](https://kubernetes.io/zh-cn/docs/tasks/configure-pod-container/configure-pod-configmap/)与 `Secret` 类似，区别是不需要加密，常用于应用的配置，可以从文件或者`yaml`对象文件进行创建。

首先，创建命名空间用于测试，方便后续清理现场：

> `kubectl create ns configmap-test`

准备`2`个配置文件，存放于`properties`目录下：

```
$ cat properties/ui1.properties
color.good=purple
color.bad=yellow
allow.textmode=true
how.nice.to.look=fairlyNice
$ cat properties/ui2.properties
color.good=purple
color.bad=yellow
allow.textmode=true
how.nice.to.look=fairlyNice
```

从目录创建`ConfigMap`，目录下的所有文件都将创建到`ConfigMap`中：

> `kubectl -n configmap-test create configmap game-config1 --from-file=properties/`

从具体的文件创建`ConfigMap`，如果需要指定建明，则需要使用 `--from-file=<我的键名>=<文件路径>` 格式:

> `kubectl -n configmap-test create configmap game-config2 --from-file=properties/ui1.properties`

可以同时从多个数据源创建`ConfigMap`：

> `kubectl -n configmap-test create configmap game-config3 --from-file=properties/ui1.properties --from-file=properties/ui2.properties`

```
$ kubectl -n configmap-test get configmap game-config3 -o yaml
apiVersion: v1
data:
  ui1.properties: |
    color.good=purple
    color.bad=yellow
    allow.textmode=true
    how.nice.to.look=fairlyNice
  ui2.properties: |
    color.good=purple
    color.bad=yellow
    allow.textmode=true
    how.nice.to.look=fairlyNice
kind: ConfigMap
metadata:
  creationTimestamp: "2024-01-18T02:29:01Z"
  name: game-config3
  namespace: configmap-test
  resourceVersion: "63813"
  uid: b5336f08-c63a-4aae-8f41-6d29b7d4a740
root@ctrlnode:/home/michael#
```

也可以使用 `--from-env-file` 从 `env` 文件进行创建，`env`文件是每行都是`key=val`的格式，而且注释和空行都将被忽略，上面的`ui1.properties`也是正确的`env`文件，但是每条配置多作为一个`key`：

> `kubectl -n configmap-test create configmap game-config4 --from-env-file=properties/ui1.properties`

```
$ kubectl -n configmap-test get configmap game-config4 -o yaml
apiVersion: v1
data:
  allow.textmode: "true"
  color.bad: yellow
  color.good: purple
  how.nice.to.look: fairlyNice
kind: ConfigMap
metadata:
  creationTimestamp: "2024-01-18T02:31:45Z"
  name: game-config4
  namespace: configmap-test
  resourceVersion: "63864"
  uid: 18e207c5-6844-499b-a760-0051a63af500
```

也可以从字面量进行创建：

> `kubectl -n configmap-test create configmap game-config5 --from-literal=special.how=very --from-literal=special.type=charm`

创建`Pod`并且挂载上面创建的`ConfigMap`：

```
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: nettool
  namespace: configmap-test
spec:
  containers:
    - name: nettool
      image: praqma/network-multitool
      imagePullPolicy: IfNotPresent
      command: ["sleep"]
      args: ["86400"]
      volumeMounts:
        - name: game-config1
          mountPath: "/etc/game/game-config1"
          readOnly: true
        - name: all-in-one
          mountPath: "/etc/all-in-one"
          readOnly: true
      env:
        - name: SPECIAL_HOW
          valueFrom:
            configMapKeyRef:
              name: game-config5
              key: special.how
        - name: ALLOW_TEXTMODE
          valueFrom:
            configMapKeyRef:
              name: game-config4
              key:  allow.textmode
  volumes:
    - name: game-config1
      configMap:
        name: game-config1
    - name: all-in-one
      projected:
        sources:
          - configMap:
             name: game-config2
             items:
               - key: ui1.properties
                 path: game-config2/ui1.properties
          - configMap:
             name: game-config3
             items:
               - key: ui2.properties
                 path: game-config3/ui2.properties
EOF
```

进入到容器中进行验证：

> `kubectl exec nettool -n configmap-test -it -c nettool -- /bin/bash`

```
$ kubectl exec nettool -n configmap-test -it -c nettool -- /bin/bash
bash-5.1# cat /etc/game/game-config1/ui1.properties
color.good=purple
color.bad=yellow
allow.textmode=true
how.nice.to.look=fairlyNice
bash-5.1# cat /etc/game/game-config1/ui2.properties
color.good=purple
color.bad=yellow
allow.textmode=true
how.nice.to.look=fairlyNice
bash-5.1# cat /etc/all-in-one/game-config2/ui1.properties
color.good=purple
color.bad=yellow
allow.textmode=true
how.nice.to.look=fairlyNice
bash-5.1# cat /etc/all-in-one/game-config3/ui2.properties
color.good=purple
color.bad=yellow
allow.textmode=true
how.nice.to.look=fairlyNice
bash-5.1# env | grep -E "SPECIAL_HOW|ALLOW_TEXTMODE"
ALLOW_TEXTMODE=true
SPECIAL_HOW=very
```

清理现场：

> `kubectl delete ns configmap-test --cascade`

### DownwardAPI

通过 [DownwardAPI](https://kubernetes.io/zh-cn/docs/concepts/workloads/pods/downward-api/) 可以将`Pod`对象本身的信息传递给容器中的环境变量或者挂载到容器中的文件，主要可以通过[fieldRef](https://kubernetes.io/zh-cn/docs/concepts/workloads/pods/downward-api/#downwardapi-fieldRef) 以及 [resourceFieldRef](https://kubernetes.io/zh-cn/docs/concepts/workloads/pods/downward-api/#downwardapi-resourceFieldRef) 进行获取，请看如下示例：

```
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: downwardapi-test
---
apiVersion: v1
kind: Pod
metadata:
  name: nettool
  namespace: downwardapi-test
  annotations:
    key1: value1
  labels:
    label1: value1
spec:
  containers:
    - name: nettool
      image: praqma/network-multitool
      imagePullPolicy: IfNotPresent
      command: ["sleep"]
      args: ["86400"]
      volumeMounts:
        - name: poduid
          mountPath: "/etc/podinfo/uid"
          readOnly: true
        - name: podinfo
          mountPath: "/etc/podinfo"
          readOnly: true
      resources:
        limits:
          memory: 50Mi
          cpu: 0.5
        requests:
          memory: 50Mi
          cpu: 0.5
      env:
        - name: SVC_ACCOUNT_NAME
          valueFrom:
            fieldRef:
              fieldPath: spec.serviceAccountName
        - name: NODE_NAME
          valueFrom:
            fieldRef:
              fieldPath: spec.nodeName
        - name: POD_IP
          valueFrom:
            fieldRef:
              fieldPath: status.podIP
        - name: POD_IPS
          valueFrom:
            fieldRef:
              fieldPath: status.podIPs
        - name: HOST_IP
          valueFrom:
            fieldRef:
              fieldPath: status.hostIP
        - name: POD_UID
          valueFrom:
            fieldRef:
              fieldPath: metadata.uid
        - name: POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: POD_NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
        - name: LIMITS_MEMORY
          valueFrom:
            resourceFieldRef:
              resource: limits.memory
        - name: REQUESTS_MEMORY
          valueFrom:
            resourceFieldRef:
              resource: requests.memory
  volumes:
    - name: poduid
      downwardAPI:
        items:
          - path: "poduid"
            fieldRef:
              fieldPath: metadata.uid
    - name: podinfo
      projected:
        sources:
          - downwardAPI:
             items:
              - path: "name"
                fieldRef:
                  fieldPath: metadata.name
              - path: "namespace"
                fieldRef:
                  fieldPath: metadata.namespace
              - path: "annotations"
                fieldRef:
                  fieldPath: metadata.annotations
              - path: "labels"
                fieldRef:
                  fieldPath: metadata.labels
              - path: "limits_cpu"
                resourceFieldRef:
                  resource: limits.cpu
                  containerName: nettool
              - path: "requests_cpu"
                resourceFieldRef:
                  resource: requests.cpu
                  containerName: nettool
EOF
```

提交成功之后，可以使用下面的命令进入容器进行验证：

> `kubectl exec -n  downwardapi-test nettool -it -c nettool -- /bin/bash`

现场清理使用如下的命令：

> `kubectl delete ns downwardapi-test --cascade`

#### 参考链接

1. [为 Pod 和容器管理资源](https://kubernetes.io/zh-cn/docs/concepts/configuration/manage-resources-containers/)
2. [Pod容器资源API](https://kubernetes.io/zh-cn/docs/reference/kubernetes-api/workload-resources/pod-v1/#%E8%B5%84%E6%BA%90)
3. [数据卷描述](https://kubernetes.io/zh-cn/docs/reference/kubernetes-api/config-and-storage-resources/volume/#Volume)
4. [DownwardAPI](https://kubernetes.io/zh-cn/docs/concepts/workloads/pods/downward-api/#downwardapi-resourceFieldRef)

### ServiceAccountToken 

当集群中的`Pod`想要和`kube-apiserver`交互时，需要通过认证，`K8S`通过`ServiceAccount`来标识应用的身份和权限控制，`ServiceAccount`是命名空间隔离的，当创建一个命名空间的时候，就会自动创建一个`default`的`ServiceAccount`，并且当我们在创建`Pod`的时候，如果没有指定`ServiceAccountName`，默认`default`，而`ServiceAccountToken`只是用来设置`ServiceAccount`对应`Token`的一些信息，如挂载路径，令牌的有效期等等。

#### 默认ServiceAccount

如下所示：

```shell
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: sa-test
---
apiVersion: v1
kind: Pod
metadata:
  name: nettool
  namespace: sa-test
spec:
  containers:
    - name: nettool
      image: praqma/network-multitool
      imagePullPolicy: IfNotPresent
      command: ["sleep"]
      args: ["86400"]
EOF
```

执行上面的命令成功之后，查看已经创建的`ServiceAccount` 和 `Pod`:

```
$  kubectl get sa,cm,pods -n sa-test -owide
NAME                     SECRETS   AGE
serviceaccount/default   0         2m5s

NAME                         DATA   AGE
configmap/kube-root-ca.crt   1      2m5s

NAME          READY   STATUS    RESTARTS   AGE    IP           NODE           NOMINATED NODE   READINESS GATES
pod/nettool   1/1     Running   0          2m5s   10.0.0.207   node           <none>           <none>
```

查看`nettool`这个`Pod`的详情，自动挂在了默认的`default`服务账号的`token`和以及访问`ApiServer`必须的证书在目录`/var/run/secrets/kubernetes.io/serviceaccount`中，在这个目录中还有证书以及命名空间等信息：

```
$ kubectl describe pod -n sa-test nettool
Name:             nettool
Namespace:        sa-test
Priority:         0
Service Account:  default
Node:             node
Start Time:       Sun, 21 Jan 2024 14:47:30 +0800
Labels:           label1=value1
Annotations:      key1: value1
Status:           Running
IP:               10.0.0.207
IPs:
  IP:  10.0.0.207
Containers:
  nettool:
    Container ID:  docker://506eeecd7fda09594ff982fa6089f9d1f31c95312c5fa67c96d7cda77ce3110c
    Image:         praqma/network-multitool
    ...
    Mounts:
      /var/run/secrets/kubernetes.io/serviceaccount from kube-api-access-kdwzv (ro)
Conditions:
  ...
Volumes:
  kube-api-access-kdwzv:
    Type:                    Projected (a volume that contains injected data from multiple sources)
    TokenExpirationSeconds:  3607
    ConfigMapName:           kube-root-ca.crt
    ConfigMapOptional:       <nil>
    DownwardAPI:             true
QoS Class:                   BestEffort
Node-Selectors:              <none>
Tolerations:                 ...
Events:
....
```

可以使用这个`token`和证书访问`kube-apiserver`的`API`，在这个之前，在集群中最好创建一个`Service`指向`ApiServer`，如下所示：

```
$ kubectl describe svc -n default kubernetes
Name:              kubernetes
Namespace:         default
Labels:            component=apiserver
                   provider=kubernetes
Annotations:       <none>
Selector:          <none>
Type:              ClusterIP
IP Family Policy:  SingleStack
IP Families:       IPv4
IP:                10.43.0.1
IPs:               10.43.0.1
Port:              https  443/TCP
TargetPort:        6443/TCP
Endpoints:         172.26.47.198:6443
Session Affinity:  None
Events:            <none>
```

进入到`Pod`之后，访问 `API`，不过默认的`default`账号权限有限，甚至无法查看本明明空间内的`Pod`列表：

```
$ kubectl exec -n sa-test nettool -c nettool -it -- /bin/bash
bash-5.1#
bash-5.1# APISERVER=https://kubernetes.default.svc
bash-5.1# SERVICEACCOUNT=/var/run/secrets/kubernetes.io/serviceaccount
bash-5.1# NAMESPACE=$(cat ${SERVICEACCOUNT}/namespace)
bash-5.1# TOKEN=$(cat ${SERVICEACCOUNT}/token)
bash-5.1# CACERT=${SERVICEACCOUNT}/ca.crt
bash-5.1# curl --cacert ${CACERT} --header "Authorization: Bearer ${TOKEN}" -X GET ${APISERVER}/api/v1/namespaces/${NAMESPACE}/pods
{
  "kind": "Status",
  "apiVersion": "v1",
  "metadata": {},
  "status": "Failure",
  "message": "pods is forbidden: User \"system:serviceaccount:sa-test:default\" cannot list resource \"pods\" in API group \"\" in the namespace \"sa-test\"",
  "reason": "Forbidden",
  "details": {
    "kind": "pods"
  },
  "code": 403
}
```

#### 自定义`ServiceAccount`

首先使用如下的命令清理`sa-test`中的资源：

> `kubectl delete ns --cascade sa-test`


然后创建下面的资源，相比默认场景，这里主要有以下改动：

- `Role`，具有`Pod`查看权限的`pod-view-role`角色；
- `ServiceAccount`，自定义的`pod-view-sa`，将被用于和`pod-view-role`角色相关联；
- `RoleBinding`，用于将`pod-view-role`角色的权限赋予`pod-view-sa`；
- 在`Pod`模板中，使用`automountServiceAccountToken: false`禁止默认挂载；
- 在`Pod`模板中，使用`serviceAccountName: pod-view-sa`表明`Pod`要关联的角色；
- 在`Pod`模板中，定义`projected`类型的`pod-view-sa-token`三合一资源，将证书、命名空间名称以及`token`挂载到容器的`/var/run/secrets/kubernetes.io/sa/pod-view-sa-token`目录中；

```
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: sa-test
---
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  namespace: sa-test
  name: pod-view-role
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]
---
apiVersion: v1
kind: ServiceAccount
metadata:
  namespace: sa-test
  name: pod-view-sa
---
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: pod-view-sa-rolebinding
  namespace: sa-test
subjects:
- kind: ServiceAccount
  name: pod-view-sa
  namespace: sa-test
roleRef:
  kind: Role
  name: pod-view-role
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: v1
kind: Pod
metadata:
  name: nettool
  namespace: sa-test
spec:
  serviceAccountName: pod-view-sa
  automountServiceAccountToken: false
  containers:
    - name: nettool
      image: praqma/network-multitool
      imagePullPolicy: IfNotPresent
      command: ["sleep"]
      args: ["86400"]
      volumeMounts:
        - name: pod-view-sa-token
          mountPath: "/var/run/secrets/kubernetes.io/sa/pod-view-sa-token"
          readOnly: true
  volumes:
    - name: pod-view-sa-token
      projected:
        sources:
        - serviceAccountToken:
            expirationSeconds: 3600
            path: token
        - configMap:
            items:
            - key: ca.crt
              path: ca.crt
            name: kube-root-ca.crt
        - downwardAPI:
            items:
            - fieldRef:
                apiVersion: v1
                fieldPath: metadata.namespace
              path: namespace
EOF
```

创建成功以后，将会看到以下资源：

```
$ kubectl -n sa-test get role,sa,cm,rolebinding,pods -owide
NAME                                           CREATED AT
role.rbac.authorization.k8s.io/pod-view-role   2024-01-21T08:14:48Z

NAME                         SECRETS   AGE
serviceaccount/default       0         15s
serviceaccount/pod-view-sa   0         15s

NAME                         DATA   AGE
configmap/kube-root-ca.crt   1      15s

NAME                                                            ROLE                 AGE   USERS   GROUPS   SERVICEACCOUNTS
rolebinding.rbac.authorization.k8s.io/pod-view-sa-rolebinding   Role/pod-view-role   15s                    sa-test/pod-view-sa

NAME          READY   STATUS    RESTARTS   AGE   IP           NODE           NOMINATED NODE   READINESS GATES
pod/nettool   1/1     Running   0          15s   10.0.0.201   node           <none>           <none>
```

进入到`Pod`中，同样查看`Pod`列表，如预期所料，访问成功：

```
$ kubectl exec -n sa-test nettool -it -- /bin/bash
bash-5.1# APISERVER=https://kubernetes.default.svc
bash-5.1# SERVICEACCOUNT=/var/run/secrets/kubernetes.io/sa/pod-view-sa-token/
bash-5.1# NAMESPACE=$(cat ${SERVICEACCOUNT}/namespace)
bash-5.1# TOKEN=$(cat ${SERVICEACCOUNT}/token)
bash-5.1# CACERT=${SERVICEACCOUNT}/ca.crt
bash-5.1# curl --cacert ${CACERT} --header "Authorization: Bearer ${TOKEN}" -X GET ${APISERVER}/api/v1/namespaces/${NAMESPACE}/pods
{
  "kind": "PodList",
  "apiVersion": "v1",
  "metadata": {
    "resourceVersion": "162533"
  },
  "items": [
    {
      "metadata": {
        "name": "nettool",
        "namespace": "sa-test",
```

#### 清理现场

清理现场使用如下命令：

> `kubectl delete ns --cascade sa-test`

#### 参考链接

1. [服务账号](https://kubernetes.io/zh-cn/docs/concepts/security/service-accounts/)
2. [投射卷API](https://kubernetes.io/zh-cn/docs/reference/kubernetes-api/config-and-storage-resources/volume/#projections)
3. [为Pod配置服务账号](https://kubernetes.io/zh-cn/docs/tasks/configure-pod-container/configure-service-account/)
4. [禁止ServiceAccount自动挂载](https://kubernetes.io/zh-cn/docs/tasks/configure-pod-container/configure-service-account/#opt-out-of-api-credential-automounting)

### emptyDir

`emptyDir` 表示与`Pod`生命周期相同的临时目录，“临时（Ephemeral）”意味着对所存储的数据不提供长期可用性的保证。`Pods`通常可以使用临时性本地存储来实现缓冲区、保存日志等功能。`kubelet`可以为使用本地临时存储的`Pods`提供这种存储空间，允许后者使用`emptyDir`类型的卷将其挂载到容器中。

```
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: emptydir-test
---
apiVersion: v1
kind: Pod
metadata:
  name: test-pd
  namespace: emptydir-test
spec:
  containers:
  - name: nettool
    image: praqma/network-multitool
    imagePullPolicy: IfNotPresent
    command: ["sleep"]
    args: ["86400"]
    volumeMounts:
      - mountPath: /var/run/cache
        name: cache-volume
  volumes:
    - name: cache-volume
      emptyDir:
        sizeLimit: 500Mi
EOF
```

### hostPath

[hostPath](https://kubernetes.io/zh-cn/docs/concepts/storage/volumes/#hostpath) 卷能将主机节点文件系统上的文件或目录挂载到`Pod`中，例如，在主机上创建目录 `/tmp/test-hostpath`：

> `mkdir /tmp/test-hostpath`

然后将该目录挂再到容器中：

```
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: hostpath-test
---
apiVersion: v1
kind: Pod
metadata:
  name: test-pd
  namespace: hostpath-test
spec:
  containers:
  - name: nettool
    image: praqma/network-multitool
    imagePullPolicy: IfNotPresent
    command: ["sleep"]
    args: ["86400"]
    volumeMounts:
      - mountPath: /tmp-test-hostpath
        name: hostpath-volume
  volumes:
    - name: hostpath-volume
      hostPath:
        path: "/tmp/test-hostpath"
        type: Directory
EOF
```

进入容器中，在 `/tmp-test-hostpath` 写入任意文件 `test.txt`，然后销毁`Pod`：

```
$ kubectl exec -it -n hostpath-test test-pd -c nettool -- /bin/bash
bash-5.1# cd /tmp-test-hostpath/
bash-5.1# echo "hello hostpath" > test.txt
bash-5.1#
bash-5.1# exit
exit
$ kubectl delete ns --cascade  hostpath-test
```

查看主机上的文件 `/tmp/test-hostpath/text.txt`，依然存在：

```
$ cat /tmp/test-hostpath/test.txt
hello hostpath
```

### 持久卷

[持久卷](https://kubernetes.io/zh-cn/docs/concepts/storage/persistent-volumes/)通常用于有数据持久化需求的`Pod`，虽然上面的`hostpath`挂载也可以实现这种需求，但是`hostpath`数据没法迁移，不够安全，没法迁移，通过持久卷可使用的存储类型就比较广泛了。在持久化存储中，有几个比较重要的概念：

- `PV（PersistentVolume）`：集群概念，表示一块存储，可以预先创建好等着来用，也可以由存储类动态创建；
- `PVC（PersistentVolumeClaim）`：用于描述存储需求，表示`Pod`需要什么类型的存储，多少空间等，只有当存在合适的`PV`来满足`PVC`的要求时，`PVC`才会和`PV`绑定，并被容器真正使用；合适意味着`PVC`的要求的类型和`PV`一样，要求的存储空间`PV`也能满足；
- `StorageClass`：用于当作`PV`的模板，用于描述它能用什么插件创建出什么类型的`PV`，当用户创建的`PVC`没有预创建的`PV`满足时，就需要通过`StorageClass`来动态创建了；
- 回收策略，主要用于告知 `PersistentVolume` 在用户删除`PVC`时如何处理之前申请的存储空间，主要有[Retain](https://kubernetes.io/zh-cn/docs/concepts/storage/persistent-volumes/#retain)和[Delete](https://kubernetes.io/zh-cn/docs/concepts/storage/persistent-volumes/#delete)，表示手动回收和删除；
- [访问模式](https://kubernetes.io/zh-cn/docs/concepts/storage/persistent-volumes/#access-modes)，表示卷以什么方式挂载到宿主机系统上，不同类型的`PV`支持的访问模式不同：
    1. `ReadWriteOnce`：卷可以被一个节点以读写方式挂载，也允许运行在同一节点上的多个 Pod 访问卷；
    2. `ReadOnlyMany`：卷可以被多个节点以只读方式挂载；
    3. `ReadWriteMany`：卷可以被多个节点以读写方式挂载；
    4. `ReadWriteOncePod`：卷可以被单个 Pod 以读写方式挂载；
- [持久卷类型](https://kubernetes.io/zh-cn/docs/concepts/storage/persistent-volumes/#types-of-persistent-volumes)，`PV` 持久卷是用插件的形式来实现的，但是这些类型并不是用户所能使用的存储类型的全集，因为还可以使用`StorageClass`动态创建`PV`，目前支持以下存储类型：
    - csi - 容器存储接口 (CSI)
    - fc - Fibre Channel (FC) 存储
    - hostPath - HostPath 卷 （仅供单节点测试使用；不适用于多节点集群；请尝试使用 local 卷作为替代）
    - iscsi - iSCSI (SCSI over IP) 存储
    - local - 节点上挂载的本地存储设备
    - nfs - 网络文件系统 (NFS) 存储


由于本地的测试条件有限，所以这里使用 `hostpath` 和 `local` 两种持久卷类型来做演示。

#### hoatpath

`hostpath` 仅适用于本地单节点测试，我们可以将节点的一个目录作为`PV`，让`Pod`都调度到这个节点上来，就可以使用这个存储卷了。首先创建一个目录用于表示`PV`：

```
$ mkdir -p /mnt/k8s/pv-test/hostpath
```

为了让`Pod`能调度到这个和`PV`强绑定的节点上来，给节点打个标签 `pvtype=hostpath`：

```shell
$ kubectl label nodes ctrlnode pvtype=hostpath
node/ctrlnode labeled
$ kubectl describe node ctrlnode
Name:               ctrlnode
Roles:              control-plane,master
Labels:             beta.kubernetes.io/arch=amd64
                    beta.kubernetes.io/instance-type=k3s
                    beta.kubernetes.io/os=linux
                    kubernetes.io/arch=amd64
                    kubernetes.io/hostname=ctrlnode
                    kubernetes.io/os=linux
                    node-role.kubernetes.io/control-plane=true
                    node-role.kubernetes.io/master=true
                    node.kubernetes.io/instance-type=k3s
                    pvtype=hostpath
....
```

创建 `hostPath` 类型的 `PV`，下面的示例中，虽然本地并没有 `manual` 类型的 `StorageClass`，但是`Kubernetes`会根据`PVC`和`PV`的存储类名称进行匹配，所以不用担心：

```shell
kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-hostpath
spec:
  storageClassName: manual
  capacity:
    storage: 2Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  hostPath:
    path: "/mnt/k8s/pv-test/hostpath"
EOF
```

创建成功之后，使用如下的命令进行验证：

```
$ kubectl get pv -owide
NAME          CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS      CLAIM   STORAGECLASS   REASON   AGE   VOLUMEMODE
pv-hostpath   2Gi        RWO            Delete           Available           manual                  3s    Filesystem
```

接下来，创建`PVC`来描述存储需求，不同于`PV`属于集群的概念，`PVC`是有命名空间的：

```
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: pv-hostpath-test
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: claim-hostpath-1
  namespace: pv-hostpath-test
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: manual
  resources:
    requests:
      storage: 1Gi
EOF
```

执行成功之后，使用下面的命令进行验证，可以看到`PV`处于绑定状态，也就是`PVC`的需求得到满足了：

```
$ kubectl get pv,pvc -n pv-hostpath-test -owide
NAME                           CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM                               STORAGECLASS   REASON   AGE    VOLUMEMODE
persistentvolume/pv-hostpath   2Gi        RWO            Retain           Bound    pv-hostpath-test/claim-hostpath-1   manual                  102s   Filesystem

NAME                                     STATUS   VOLUME        CAPACITY   ACCESS MODES   STORAGECLASS   AGE   VOLUMEMODE
persistentvolumeclaim/claim-hostpath-1   Bound    pv-hostpath   2Gi        RWO            manual         45s   Filesystem
```

接下来就是创建`Pod`使用这个`hostpath`类型的`PV`了，这里的`spec.affinity.nodeAffinity`表明要把`Pod`调度到具有`pvtype=hostpath`的节点中去：

```
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: nettool
  namespace: pv-hostpath-test
spec:
  containers:
    - name: nettool
      image: praqma/network-multitool
      imagePullPolicy: IfNotPresent
      command: ["sleep"]
      args: ["86400"]
      volumeMounts:
        - mountPath: /hostpath/storage
          name: pv-hostpath-volume
  volumes:
    - name: pv-hostpath-volume
      persistentVolumeClaim:
        claimName: "claim-hostpath-1"
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
            - key: pvtype
              operator: In
              values:
                - hostpath
EOF
```

进入容器的`/hostpath/storage`目录中，创建文件 `text.txt`：

```
$ kubectl exec -n pv-hostpath-test -it nettool -- /bin/bash
bash-5.1# cd /hostpath/storage
bash-5.1# echo "written in container" > text.txt
bash-5.1# exit
exit
```

这个时候查看`ctrlnode`节点上的`/mnt/k8s/pv-test/hostpath`目录，存在`text.txt`文件。而且即使销毁`Pod`然后重建，只要依然使用这个`PVC`，它的数据依然是存在的，这就做到了数据的持久化：

```
$ cat /mnt/k8s/pv-test/hostpath/text.txt
written in container
```

清理现场使用：

> `kubectl delete ns --cascade  pv-hostpath-test`
> `kubectl delete pv pv-hostpath`
> `kubectl label nodes ctrlnode pvtype-`

#### local

[local](https://kubernetes.io/zh-cn/docs/concepts/storage/volumes/#local)用于表示某个被挂载的本地存储设备，例如磁盘、分区或者目录，只能用作静态创建的持久卷，不支持动态配置。与 `hostPath` 卷相比，`local` 卷能够以持久和可移植的方式使用，而无需手动将 `Pod` 调度到节点，而 `local`可以让`Pod`自动去选择节点，核心含义就是首先让`PV`存在于具有特征的节点上，这样当`PVC`被和`PV`绑定时，`PVC`也具有了节点亲和性，当最后的使用者`Pod`出现时，要使用这个`PVC`就得被调度到满足条件的`PV`所在的节点上。

同样，为了演示，首先本地创建一个目录用于制备`PV`：

```
$ mkdir -p /mnt/k8s/pv-test/local
```

给节点打个标签 `pvtype=local`：

> `kubectl label nodes ctrlnode pvtype=local`

创建`PV`，并且使用`nodeAffinity`指定满足条件的节点：

```
kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolume
metadata:
  name: example-pv-local
spec:
  capacity:
    storage: 100Gi
  volumeMode: Filesystem
  accessModes:
  - ReadWriteOnce
  persistentVolumeReclaimPolicy: Delete
  storageClassName: local-storage
  local:
    path: /mnt/k8s/pv-test/local
  nodeAffinity:
    required:
      nodeSelectorTerms:
      - matchExpressions:
        - key: pvtype
          operator: In
          values:
          - local
EOF
```

使用如下的命令验证是否创建成功：

```
$ kubectl get pv
NAME               CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS      CLAIM   STORAGECLASS    REASON   AGE
example-pv-local   100Gi      RWO            Delete           Available           local-storage            5s
```

然后创建`PVC`，申请这个`local`类型的`PV`：

```
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: pv-local-test
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: claim-local-1
  namespace: pv-local-test
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: local-storage
  resources:
    requests:
      storage: 1Gi
EOF
```

创建成功之后，可以看到`PV`和`PVC`都是绑定状态了：

```
$ kubectl get pv,pvc -n pv-local-test
NAME                                CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM                         STORAGECLASS    REASON   AGE
persistentvolume/example-pv-local   100Gi      RWO            Delete           Bound    pv-local-test/claim-local-1   local-storage            118s

NAME                                  STATUS   VOLUME             CAPACITY   ACCESS MODES   STORAGECLASS    AGE
persistentvolumeclaim/claim-local-1   Bound    example-pv-local   100Gi      RWO            local-storage   11s
```

同样创建一个`Pod`来使用这个`PVC`，与`hostpath`不同的时，这里不用再使用节点亲和性用来表示`Pod`要被调度到哪个节点了：

```
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: nettool
  namespace: pv-local-test
spec:
  containers:
    - name: nettool
      image: praqma/network-multitool
      imagePullPolicy: IfNotPresent
      command: ["sleep"]
      args: ["86400"]
      volumeMounts:
        - mountPath: /pv-local/storage
          name: pv-local-volume
  volumes:
    - name: pv-local-volume
      persistentVolumeClaim:
        claimName: "claim-local-1"
EOF
```

进入到容器中，创建文件进行测试：

```
$ kubectl exec -it -n pv-local-test nettool -- /bin/bash
bash-5.1#  cd /pv-local/storage/
bash-5.1# echo "written in container" > test.txt
bash-5.1# exit
exit
```

在宿主机上的`/mnt/k8s/pv-test/local`中可以看到这个文件：

```
$ cat /mnt/k8s/pv-test/local/test.txt
written in container
```

清理现场使用如下的命令：

> `kubectl delete ns --cascade pv-local-test`
> `kubectl delete pv example-pv-local`
> `kubectl label nodes ctrlnode pvtype-`

