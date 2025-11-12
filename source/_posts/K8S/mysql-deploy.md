---
title: K8S集群中部署MySQL
date: 2025-07-19 19:23:19
tags:
    - mysql
    - MySQL部署
categories:
    - k8s
---

本文描述如何在k8s集群中部署一个MySQL服务，前提请看[K8S集群部署](/2023/12/17/K8S/kubeadm-deploy/)创建一个测试集群。如我本地，仅有一个控制节点：

```shell
root@ctrlnode:/home/ubuntu# kubectl get nodes
NAME       STATUS   ROLES           AGE   VERSION
ctrlnode   Ready    control-plane   72m   v1.28.15
```

### 创建hostpath目录

这里创建的目录将被用于`PV`卷创建，MySQL服务产生的数据也将保存在这个目录下。如果目录变更，请同步修改后续的`PV`卷的`hostpath`路径：

> mkdir -p /mnt/k8s/mysql-demo/mysql-data

### 为节点增加标签

为了让`Pod`能调度到这个和`PV`强绑定的节点上来，给节点打个标签`pvtype=hostpath`：

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

<!--more-->

### 部署MySQL服务
将下面的模板保存为 `mysql.yaml`，然后从文件创建`MySQL`服务：
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: mysql-demo
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: mysql-config
  namespace: mysql-demo
  labels:
    app: mysql
data:
  my.cnf: |-
    [client]
    default-character-set=utf8mb4
    [mysql]
    default-character-set=utf8mb4
    [mysqld] 
    max_connections = 2000
    secure_file_priv=/var/lib/mysql
    sql_mode=STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
---
## PV
apiVersion: v1
kind: PersistentVolume
metadata:
  name: mysql
  namespace: mysql-demo
  labels:
    app: mysql
spec:
  storageClassName: manual
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  hostPath:
    path: "/mnt/k8s/mysql-demo/mysql-data"
---
## PVC
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mysql
  namespace: mysql-demo
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: manual
  resources:
    requests:
      storage: 1Gi
  selector:
    matchLabels:
      app: mysql #根据 Label 选择对应 PV
---
## Service
apiVersion: v1
kind: Service
metadata:
  name: mysql
  namespace: mysql-demo
  labels:
    app: mysql
spec:
  type: NodePort
  ports:
    - name: mysql
      port: 3306
      targetPort: 3306
      nodePort: 30336
  selector:
    app: mysql
---
## StatefulSet
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
  namespace: mysql-demo
  labels:
    app: mysql
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      containers:
        - name: mysql
          image: mysql
          ports:
            - containerPort: 3306
          env:
            - name: MYSQL_ROOT_PASSWORD ## 配置Root用户默认密码
              value: "123456"
          resources:
            limits:
              cpu: 1000m
              memory: 512Mi
            requests:
              cpu: 1000m
              memory: 512Mi
          livenessProbe:
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            successThreshold: 1
            failureThreshold: 3
            exec:
              command:
                ["mysqladmin", "-uroot", "-p${MYSQL_ROOT_PASSWORD}", "ping"]
          readinessProbe:
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
            successThreshold: 1
            failureThreshold: 3
            exec:
              command:
                ["mysqladmin", "-uroot", "-p${MYSQL_ROOT_PASSWORD}", "ping"]
          volumeMounts:
            - name: data
              mountPath: /var/lib/mysql
            - name: config
              mountPath: /etc/mysql/conf.d/my.cnf
              subPath: my.cnf
            - name: localtime
              readOnly: true
              mountPath: /etc/localtime
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: mysql
        - name: config
          configMap:
            name: mysql-config
        - name: localtime
          hostPath:
            type: File
            path: /etc/localtime
```

执行命令：

```shell
root@ctrlnode:/home/ubuntu/mysql-test# kubectl apply -f mysql.yaml
namespace/mysql-demo created
configmap/mysql-config created
persistentvolume/mysql created
persistentvolumeclaim/mysql created
service/mysql created
statefulset.apps/mysql created
```

### 集群内验证MySQL登录

上面的模板还创建了`NodePort`类型的`MySQL`服务，所以在集群之内进行登录。首先创建一个临时的客户端容器：

> kubectl run mytools -n mysql-demo -it --rm --image=mysql --image-pull-policy=IfNotPresent --command -- /bin/bash

然后通过`mysql`名字访问数据库：

> mysql -h mysql -P 3306 --user=root --password=123456

![](mysql-login.png)

### 集群外验证MySQL登录

`NodePort`类型的服务可以从`k8s`集群外进行访问，这里在集群之外使用`docker`创建个`MySQL`客户端进行验证。首先查看`MySQL`服务的暴露在节点上的端口：
![](mysql-svc.png)

这里使用`docker`创建的`MySQL`客户端和`K8S`集群就不在同一个网络了，是在集群之外访问，需要使用节点的`IP`地址：

```shell
root@ctrlnode:/home/ubuntu/mysql-test# ifconfig enp0s1
enp0s1: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 192.168.67.15  netmask 255.255.255.0  broadcast 192.168.67.255
        inet6 fe80::5054:ff:fe4d:9547  prefixlen 64  scopeid 0x20<link>
        inet6 fd96:5cad:8347:c4a6:5054:ff:fe4d:9547  prefixlen 64  scopeid 0x0<global>
        ether 52:54:00:4d:95:47  txqueuelen 1000  (Ethernet)
        RX packets 977281  bytes 1235853010 (1.2 GB)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 245325  bytes 24153583 (24.1 MB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0
```

接下来使用`docker`创建一个临时的`MySQL`客户端容器：

> docker run --network host -it --rm  mysql bash

![](mysql-login1.png)
