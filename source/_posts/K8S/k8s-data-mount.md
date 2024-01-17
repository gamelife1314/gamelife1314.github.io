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

然后将创建的`Secret`挂载到`Pod`中：

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
