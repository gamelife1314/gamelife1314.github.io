---
title: MySQL 常用问题整理
date: 2019-04-21 21:20:46
tags:
  - MySQL
categories:
  - 数据库
---


### MySQL 的架构组成以及各层职责？

MySQL 是一个分层设计架构，总提上可以分为 Server 层和存储层两层。如下图所示：    

{% asset_img  architecture.png 架构 %}

<!--more-->

其中 Server 层又可以分为连接器，分析器，优化器，执行器四部分，涵盖 MySQL 大多数核心服务功能，以及所有的内置函数，所有跨引擎的功能都在这一层实现。各层负责的事情如下：

连接器：负责和客户端建立连接、获取权限、维持和管理连接，这个期间会负责校验用户身份，身份认证通过之后，连接器会查询到当前用户的所有的权限，后续的权限判断都会基于查询到的结果。可以通过 `show processlist` 查询到服务器已经建立的连接列表，如果连接建立完成之后，没有后续动作，那么这个连接的状态就处于 `Sleep` 状态。客户端如果太长时间没有任何操作，超过参数 [`wait_timeout`](https://dev.mysql.com/doc/refman/5.7/en/server-system-variables.html#sysvar_wait_timeout) 指定的时间之后，就会断开连接，再次操作需要重新连接。由于建立连接程序复杂，耗时较多，所以应该尽可能使用长连接，但长期使用长连接导致内存使用率增长很快，这是因为 MySQL 在执行过程中临时使用的内存都是管理在连接对象里面的，并且只有在连接断开的时候才会释放，长时间累计，可能导致 MySQL 被系统强行杀掉（OOM），所以我们应该在使用长连接的情况下，定期断开长连接，并且在执行大的操作之后，通过 [`mysql_reset_connection`](https://dev.mysql.com/doc/refman/5.7/en/mysql-reset-connection.html) 来重新初始化连接资源，但不需要重新连和鉴权。此阶段常见的错误有：Access denied for user。

查询缓存：以 SELECT 语句为 key，将查询结果缓存，如果命中缓存，则直接返回给客户端。但是这个功能弊大于利，不建议使用，MySQL 8.0 已经废弃，因为缓存失效频繁，基本排不上用场。

分析器：真正开始执行语句之前，需要先对语句做词法分析和语法分析，识别出这个 SQL 语句要做什么操作，如果 SQL 语法错误，将会看到我们常见错误：You have an error in your SQL syntax。

优化器：经过分析器，优化器需要对 SQL 语句进行优化，优化器会在表里面有多个索引的时候，决定使用哪个索引，或者一个表有多表关联的时候，决定各个表的连接顺序，经过优化器处理，接下来就要到执行阶段了。

执行器：经过优化器的诊治之后，就到了真正执行的阶段了，但是在开始执行的时候，需要先判断对这个表有没有相应的操作权限，如果没有，就会返回没有权限的错误。

### 慢查询日志是什么，如何开启？

[慢查询日志：slow_query_log](https://dev.mysql.com/doc/refman/5.7/en/slow-query-log.html) 包含执行时间超过 [`long_query_time`](https://dev.mysql.com/doc/refman/5.7/en/server-system-variables.html#sysvar_long_query_time) 以及扫描行数超过 [`min_examined_row_limit`](https://dev.mysql.com/doc/refman/5.7/en/server-system-variables.html#sysvar_min_examined_row_limit) 的 SQL 语句。慢查询日志用于去找到执行时间很长的 SQL 语句，可以使用 [`mysqldumpslow `](https://dev.mysql.com/doc/refman/5.7/en/mysqldumpslow.html) 用于分析慢查询日志。

开启 MySQL 慢查询的方式如下（MySQL 5.7），修改配置文件 `/etc/mysql/mysql.conf.d/mysqld.cnf`，添加：

    [mysqld]
    ...
    # 开启慢查询日志
    slow_query_log=1
    # 设置慢查询日志文件  
    slow_query_log_file=/var/log/mysql/slow.log
    # 当 SQL 执行时间超过这个参数的设置时候，才会记录
    long_query_time=0
    # 记录没有使用索引的查询语句
    log_queries_not_using_indexes=ON


### 什么是 Redo Log，重做日志？

Redo Log 详细介绍，详见 [https://dev.mysql.com/doc/refman/5.7/en/innodb-redo-log.html](https://dev.mysql.com/doc/refman/5.7/en/innodb-redo-log.html)。与查询流程不同的是，当要更新一条记录的时候，InnoDB 会先把记录写道 Redo Log，并且更新内存。这个时候就算是更新结束。同时，InnoDB 会在空闲的时候，将这个操作记录到更新到磁盘，这就是传说中的 WAL 技术。MySQL 中的 Redo Log 是固定大小的，比如可以配置为一组 4 个文件，每个文件大小是 4GB，具体由系统变量 [`innodb_log_file_size`](https://dev.mysql.com/doc/refman/5.7/en/innodb-parameters.html#sysvar_innodb_log_file_size) 和 [`innodb_log_files_in_group`](https://dev.mysql.com/doc/refman/5.7/en/innodb-parameters.html#sysvar_innodb_log_files_in_group) 控制。Redo Log 与 Bin log 不同的是，前者采用循环写的策略，而后者采用追加写。有了 Redo Log，InnoDB 就可以保证即使数据库发生异常重启，之前提交的数据都不会丢失，这个能力称之为 Crash-Safe，详见 [https://dev.mysql.com/doc/refman/5.7/en/innodb-recovery.html](https://dev.mysql.com/doc/refman/5.7/en/innodb-recovery.html)。同时根据官方解释，Redo Log 是一个基于磁盘的数据结构（物理上存在与 MySQL 数据目录下，名称为：ib_logfile*），用于在奔溃恢复期间纠正不完整事务写入的数据。

### 什么是 Binary Log?

有关 Biary Log 的官方文档，详见 [https://dev.mysql.com/doc/refman/5.7/en/innodb-recovery.html](https://dev.mysql.com/doc/refman/5.7/en/innodb-recovery.html)，配置参数详见 [https://dev.mysql.com/doc/refman/5.7/en/replication-options-binary-log.html](https://dev.mysql.com/doc/refman/5.7/en/replication-options-binary-log.html)。据官方文档介绍，Binary Log 包含描述数据库更新的事件，例如表创建或者更新，也包含了每个语句花在更新数据上的事件，主要目的有两个：

- 对于副本，主服务器上的二进制日志提供要发送到从服务器上数据更新的记录，主服务器将其二进制日志中包含的事件发送到从服务器，从服务器执行这些事件以对主服务器进行相同的数据更改。

- 用于恢复数据，对于删除删除删数据，只要存在备份数据，大可不必太担心，只要知道最近的一个备份点，然后根据二进制日志将其重放，即可恢复数据。

与 Redo Log 不同的时候，Redo Log 输入 InnoDB 引擎特有的日志，而 Binary Log 属于 MySQL Server 提供的日志。Redo Log 是物理日志，记录的是 “在某个数据页上做了什么操作”，而 Binary Log 记录的是逻辑日志，记录这个语句的原始逻辑。

### 更新语句执行的详细过程？

对于下面这样的一条语句，它的详细执行过程是怎么样的？（InnoDB 引擎）

    mysql> update T set c=c+1 where ID=2;

1. 执行器通知 InnoDB 获取表 `T` 中 `ID=2` 这一行。加入 `ID` 是主键，引擎根据索引树找到这一行，如果 ID=2 所在的数据页本来就存在与内存中，就直接返回给执行器。否则先要从磁盘读入，再返回。

2. 执行拿到引擎给的行数据，把这个值加1，得到新的一行数据，再调用引擎接口写入这行数据。

3. 引擎将这行数据更新到内存中，同时将这个更新操作记录到 Redo Log 中，此时的 Redo Log 处于 Prepare 阶段，然后通知执行器执行结束了，可以所示提交事务。

4. 执行器生成这个操作的 Binary Log，并把 Binary Log 写入磁盘。

5. 执行器调用引擎的事务提交接口，引擎把刚刚写入的 Redo Log 改成提交状态，更新完成。

### 什么是事务？

事务就是要保证一组数据库操作，要么全部成功，要么全部失败。MySQL 中，事务是由引擎层实现的，MySQL 是一个支持多引擎的系统，但是并不是所有的引擎都支持事务，这也是 MyISAM 被 InnoDB 取代的原因之一，事务具有四个性质：Atomicity、Consistency、Isolation、Durability。

### 隔离性中的合理级别有哪些？

当数据库中有多个事务的时候，就可能出现脏读，不可重复读，幻读的问题，为了解决这些问题，就有了隔离级别的概念。但是，在谈隔离级别的时候，要知道，隔离的越严实，效率就越低， SQL 标准事务中的[隔离级别](https://dev.mysql.com/doc/refman/5.7/en/glossary.html#glos_isolation_level)包括：读未提交，读提交，可重复读，串行化。

读未提交：一个事务还没提交时，它做的变更就能被别的事务看到；

读提交：一个事务提交之后，它做的变更才会被其他事务看到；

可重复读：一个事务执行过程中看到的数据，总是跟这个事务在启动的时候看到的数据是一致的。当然在此隔离级别下，未提交变更对其他的事务也是不可见的。

串行化：顾名思义，对于同一行记录，“写” 会加 “写锁”，“读” 会加 “读锁”，当出现锁冲突的时候，后访问的事务必须等待前一个事务执行完成，才能继续执行。

事务隔离级别的设置由参数 [`transaction_isolation`](https://dev.mysql.com/doc/refman/5.7/en/server-system-variables.html#sysvar_transaction_isolation) 设定。

### 可重复读隔离级别的实现？

在 MySQL 中，实际上每一条更新语句在更新的时候都会同时记录一条[回滚日志](https://dev.mysql.com/doc/refman/5.7/en/innodb-undo-logs.html)，记录上的最新值，通过回滚操作，就能得到前一个状态的值。假设一个值从 1 被按顺序改成了 2、3、4，在回滚日志里面就会看到类似下面的记录：

![undo log](undolog.png)

当前值是4，但是在查询这条记录的时候，不同时刻启动的事务会有不同的 read-view，如图中，在不同事务 A、B、C里面，这一个记录的值分别是1、2、4，同一条记录可以在系统中存在多个版本，就是数据库的多版本并发控制(MVCC)，就必须将当前值依次执行试图中所有的回滚操作得到。回滚日志会在不需要的时候删除，系统会判断，当再没有事务需要这些回滚日志的时候，回滚日志就会被删除。

### 如何开启事务？

MySQL 事务启动有以下两种：

1. 显式启动事务语句，`begin` 或者 `start transaction` ，配置的提交语句是 `commit`，回滚语句是 `rollbck`。

2. `set autocommit=0` 这个命令会将这个线程的自动提交关掉，意味着只要你执行一个 select 语句，事务就开始了，知道主动执行 `commit` 或者 `rollback`，或者断开连接。

`commit work and chadin` 用于提交本次事务，并且开启新的事务；

### 为什么避免使用长事务？

长事务意味着系统里面会存在很老的事务试图，由于这些事务可能访问数据库里面的任何数据，数据库里面用到的回滚日志都必须记录，导致占用大量存储空间。

使用如下 SQL 语句可以查询当前 MySQL 中执行时间超过 60s 的事务：

    select * from information_schema.innodb_trx where TIME_TO_SEC(timediff(now(),trx_started))>60

### 为什么要加索引，常见的索引模型有哪些，优缺点？

数据库索引类似书籍目录，索引的出现就是为了加快查询的效率。常见的索引模型有：哈希表，有序数组和搜索树。

哈希表是一种 key-value 存储数据的结构，根据 key 计算出该 key 的具体存储位置，然后再读出，时间复杂度是 O(1)，但是不支持范围查找并且可能存在冲突。

有序数组支持等值查询，也支持范围查找，但是在插入的时候，成本太大，最高时间复杂度 O(n)，适用于静态数据，不存在插入的情况。

搜索树，二叉搜索数（BST）的查找，插入的是时间复杂度是O(logn)，这里的n指的是树的高度，但是当数据量高达百万千万时，数据的高度会很大，在 MySQL 中，数据存储在磁盘中，增加了读磁盘的次数，就会增加响应时间，所以 MySQL 中索引数是 N 叉树，以 InnoDB 为例，这里的 N 大概差不多是 1200，所以在在树高3，4 层的时候，存储数据就将近20亿。

在 InnoDB 中，表都是根据主键顺序以索引的形式存在的，这种存储方式的表成为索引组织表，InnoDB 使用了 B+ 树索引模型，所以数据都是存储在 B+ 树中的。InnoDB 的索引可以根据叶子节点存储的内容分为为主键索引和非主键索引，主键索引树叶子节点存储的是整行数据的内容，在 InnoDB 中，主键索引也称之为聚簇索引(clustered index)，非主键索引的叶子节点内容是主键的值，在 InnoDB 中，非主键索引也被称为二级索引（secondary index）。所以在查询中，基于主键索引的查询和普通索引的查询是有区别的，基于主键索引的查询只需扫描主键索引这棵树，基于普通索引的查询需要先搜索普通索引树，然后再到主键索引树上查询，称为 **回表**。

### 数据表是否一定要有自增主键，可有例外？

自增主键是指在自增列上定义的主键，建表语句中我们一般会这么写：`NOT NULL AUTO_INCREMENT PRIMARY KEY`，那么在插入记录的时候，可以不指定这列的值，或者这列的值是 null 或者 0 的时候，系统会获取当前该列最大值加1作为下一条记录的值。自增主键的插入方式中，在维护主键索引树的时候，涉及到的基本都是追加操作，不会涉及到挪动索引树其他叶子节点，也不会触发叶子节点所在数据页的分裂，进而导致页合并删除等操作。

但是如果使用业务字段做主键，则往往不容易保证有序插入，这样写数据的成本较高。如果从存储的角度考虑，使用自增主键索引，可以降低对存储成本。例如，如果使用身份证号做主键，那么每个二级索引的主键占用约20个字节，而如果用整形做主键，则只要4个字节，即使长整形，也只要8字节而已。显然，主键长度越小，普通索引的叶子节点就越小，索通索引占用的空间也就越小。

不过在 KV 场景下，这种表中，只有一个索引，并且是唯一索引，那么我们就可以使用 key 字段作为主键了。

### 如何重建主键索引？

重建普通索引，可以使用如下的方式：

    alter table T drop index k;
    alter table T add index(k);

但是，重建主键索引的时候，万万不可如此：

    alter table T drop primary key;
    alter table T add primary key(id);

取而代之的是：`alter table T engine=InnoDB`，因为不管是创建主键还是删除主键，都会重建整张表。

### 什么是覆盖索引？

对于如下的表：

    mysql> create table T (
    ID int primary key,
    k int NOT NULL DEFAULT 0, 
    s varchar(16) NOT NULL DEFAULT '',
    index k(k))
    engine=InnoDB;

    insert into T values(100,1, 'aa'),(200,2,'bb'),(300,3,'cc'),(500,5,'ee'),(600,6,'ff'),(700,7,'gg');

当我们执行语句 `select * from T where k between 3 and 5`的时候，会首先去扫描普二级索引树 k，对于每一个匹配到的值，都要去主键索引树上查找整行数据记录的值。但是当我们执行 `select ID from T where k between 3 and 5` 的时候，因为索引树k中已经包含了 ID 值，索引不用回表。

**由于使用覆盖索引可以减少树的搜索次数，显著提高查询性能，所以使用覆盖索引是一个常用的性能优化手段**，因此。所谓覆盖索引，就是索引树中叶子节点的内容已经覆盖了我们查询数据的需求，不用再回到主键查找。

### 什么是最左前缀原则？

虽然索引可以起到加速查询的效果，但是如果我们为每一种查询情况都建立索引，那岂不是索引风暴了，在插入或者更新的时候，导致维护大量索引，也会影响效率。取而代之的是，我们建立多个字段的联合索引，利用 B+ 树索引前缀来定位记录。例如，我们用一个表里面的 name 和 age 字段建立联合索引：

    alter table t add index name_age_index ('nane', 'age');

这样我们在根据姓名查找（`where name = "战三"`），姓名和年龄组合查找（`where name = "战三" and age=10`），甚至查找姓张的人的时候，也能用到这个索引（`where name like "张%"`），可以看到，不只是索引的全部定义，只要满足最左前缀，就可以利用这个索引来加速检查。这个最左索引可是这个联合索引的最左 N 个字段，也可以是字符串索引的最左 M 个字符。

基于前面的说明，在建立联合索引的时候，我们要考虑索引的复用能力，因为可以支持最左前缀，所以当已经有了 (a,b) 这个联合索引的时候，就不需要再在 (a) 上单独建立索引了，但是如果要单独查询b字段，就要在 b 上单独建立索引了。

MySQL 5.6 引入了 [索引下推（ICP）](https://dev.mysql.com/doc/refman/5.7/en/index-condition-pushdown-optimization.html)，对基于最左前缀匹配的查询做了查询优化。

### 什么是全局锁，有哪些使用场景？

全局锁，顾名思义就是对整个数据库实例加锁。MySQL 提供了一个添加全局读锁的方法，命令式 `flush tables with read lock`，当你想让整个库处于只读状态的时候，可以使用这个明令，之后其他线程以下语句会被阻塞：数据更新语句（数据的增删改）、数据定义语句（建表，修改表等）、更新类事务的提交语句。

全局锁的典型使用场景是，做全库逻辑备份，也即是把整个表都 select 出来存成文本。但是整库全局读很危险：

- 主库上备份，备份期间都不能执行更新，业务今本上就得停摆；

- 从库上备份，那么备份期间不能执行主库同步过来的 binlog，会导致主从延迟。

正确的全局备份是使用 MySQL 官方自带的工具：mysqldump，当 mysqldump 使用参数  `--single-transaction` 的时候，导数据之前会启动一个事务，来确保拿到一致性视图，由于 MVCC 的支持，这个过程是可以做数据更新的。这个功能是好，但前提是引擎要支持这个隔离级别，比如 MyISAM 这种不支持事务的引擎，如果备份过程中总有更新，那就破坏了备份的一致性，这时就不得不使用 `FTWRL` 命令了。

还有一种方式也可以将全库置于只读状态，那就是 `set global readonly=true`，但是这种不好，原因有二：

- 在有些系统中，readonly 会被用来做其他逻辑，比如用来判断一个库是主库还是从库，这种方式影响面太大，不建议使用；

- 异常处理机制有差异，如果 `FTWRL` 命令之后由于客户端发生异常断开，那么 MySQL 会自动释放这个全局锁，整个库回到可以正常更新的状态。而将整个库设置为 readonly 之后，如果客户端发生异常，则数据库就会一直保持 readonly 状态，这样会导致整个库长时间处于不可写状态，风险较高。

### 什么是表级锁？

MySQL 里面表级锁有两种：一种是表锁，一种是云数据锁（meta data lock, MDL）。

表锁的语法是 [`lock tables ... read/write`](https://dev.mysql.com/doc/refman/5.7/en/lock-tables.html)，与 FTWRL 类似，可以用 `unlock tables` 主动释放锁，也可以在客户端断开的时候自动释放。需要注意，lock tables 除了限制别的线程读写外，也限定了本线程接下来的操作对象。

举个例子, 如果在某个线程 A 中执行 `lock tables t1 read, t2 write`; 这个语句，则其他线程写 t1、读写 t2 的语句都会被阻塞。同时，线程 A 在执行 unlock tables 之前，也只能执行读 t1、读写 t2 的操作。连写 t1 都不允许，自然也不能访问其他表。

**另一类表级锁是 MDL（meta data lock），MDL 不需要显示使用，在访问一个表的时候会自动加上**。MDL 的作用是保证读写的正确性，例如，当一个查询正在遍历一个表的时候，而执行期间另外一个线程对这个表结构做更改，删了一列，那么查询线程拿到的结果跟表结构肯定对不上，肯定是不行的。

MySQL 5.5 引入了 MDL，在对一个表做增删改查的时候，加 MDL 读锁，当要对表结构变更操作的时候，加 MDL 写锁。读锁之间不互斥，读写锁，写锁之间互斥，用来保证变更别结构操作的安全性。

既然如此，我们在对线上业务做表结构更改的时候，就要小心谨慎，否则，可能造成线上业务直接挂掉，那么如何安全地修改表结构呢？首先杀掉长事务，或者等事务执行完在 DDL，可以去 `information_schema.innodb_trx` 表中查找出长事务将其杀掉。但是如果是一个热点表，请求频繁，kill 事务可能就不管用了，刚杀完新的就起来了。这个时候，我们可以使用 MariaDB 提供的一个功能，在 alter table 语句里面指定等待时间，如果在这个等待时间里能拿到 MDL 写锁最好，如果拿不到也不要阻塞后面的业务语句：

    ALTER TABLE tbl_name NOWAIT add column ...
    ALTER TABLE tbl_name WAIT N add column ... 

### 什么是行锁？

MySQL 中的行锁是由各个引擎自己实现的，但是并不是所有的引擎都支持行锁，MyISAM就不支持行锁，不支持行锁意味着并发控制只能使用表级锁，对于这种引擎的表，同一张上任何时刻只能有一个更新在执行，这就会影响业务的并发度，InnoDB 引擎是支持行锁的。

InnoDB 事务中，行锁是需要的时候才加上的，但并不是不需要了就立刻释放，而是需要等到事务束时才释放，这就是 **两阶段锁协议**。由于行锁是在事务提交的时候才释放，所以合理的安排 SQL 顺序能够有效提高并发度，要把最可能造成冲突，最可能影响并发度的锁的申请时机尽量往后放。

### 为什么会出现死锁，出现死锁的时候怎么解决？

当并发系统中不同线程出现循环资源依赖，涉及的线程都在等别的线程释放资源时，就会导致这几个线程都进入无限等待的状态，称为死锁。例如：

|事务A|事务B|
|:---:|:--:|
|begin;<br>update t set k=k+1 where id = 1;|begin|
||update t set k=k+1 where id = 2;|
|update t set k=k+1 where id = 2;|&nbsp;|
||update t set k=k+1 where id = 1;|

这个例子中，事务A在等待事务B释放id=2的行锁，事务B在等待事务A释放id=1的行锁，就进入了级锁状态。当出现死锁以后，有两种策略：

- 一种策略是，直接进入等待，直到超时，这个超时时间可以通过参数 [innodb_lock_wait_timeout](https://dev.mysql.com/doc/refman/5.7/en/innodb-parameters.html#sysvar_innodb_lock_wait_timeout) 设置；
- 另一种策略是，发起死锁检测，发现死锁以后，主动回滚死锁链条中的某一个事务，让其他事务得以继续执行。[innodb_deadlock_detect](https://dev.mysql.com/doc/refman/5.7/en/innodb-parameters.html#sysvar_innodb_deadlock_detect) 参数设置为 on 表示开启这个功能。

innodb_lock_wait_timeout 既不能太大也不能太小，大了客户端接收，默认时间 50s，哪个客户端能耐心能 50s，业务爸爸不早炸了。太小，又会误伤，简单的所等待也会被认为是死锁。

所以正常情况下，我们还是要采用第二种策略，主动死锁检测，而且 `innodb_deadlock_detect` 默认值本身就是 on，主动死锁加啊安策发生在死锁的时候，是能够快速发现并进行处理的。

### 备库使用 `--single-transaction` 做逻辑备份的时候，如果主库的 binlog 传来一个 DDL 语句会如何？

假设这个 DDL 是针对 t1，我们被把备份过程中几个关键语句列出来：

    Q1:SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
    Q2:START TRANSACTION  WITH CONSISTENT SNAPSHOT；
    /* other tables */
    Q3:SAVEPOINT sp;
    /* 时刻 1 */
    Q4:show create table `t1`;
    /* 时刻 2 */
    Q5:SELECT * FROM `t1`;
    /* 时刻 3 */
    Q6:ROLLBACK TO SAVEPOINT sp;
    /* 时刻 4 */
    /* other tables */

备份开始的时候，为了确保 RR 隔离级别，再设置一次（Q1）。

启动事务，这里用 `WITH CONSISTENT SNAPSHOT` 确保拿到一致性视图（Q2）。

设置一个保存点（Q3）;

`show create table ` 是为了拿到表结构（Q4），然后正式导数据（Q5）,回滚到 SAVEPOINT sp，在这里的所用释放 t1 的 MDL 读锁（Q6）。

根据 DDL 传过来的时刻，分为四种情况：

1. 如果在 Q4 语句执行之前到达，现象：没有影响，备份拿到的是 DDL 后的表结构。
2. 如果在“时刻 2”到达，则表结构被改过，Q5 执行的时候，报 Table definition has changed, please retry transaction，现象：mysqldump 终止；
3. 如果在“时刻 2”和“时刻 3”之间到达，mysqldump 占着 t1 的 MDL 读锁，binlog 被阻塞，现象：主从延迟，直到 Q6 执行完成。
4. 从“时刻 4”开始，mysqldump 释放了 MDL 读锁，现象：没有影响，备份拿到的是 DDL 前的表结构。

### MySQL 是如何快速创建一致性视图的？

    mysql> CREATE TABLE `t` (
    `id` int(11) NOT NULL,
    `k` int(11) DEFAULT NULL,
    PRIMARY KEY (`id`)
    ) ENGINE=InnoDB;
    insert into t(id, k) values(1,1),(2,2);

在这里强调一下，`begin 和 start transaction` 并不是一个事务的起点，在执行到他们之后的第一个操作 InnoDB 表的语句，事务才真正启动。如果要马上启动一个事务，可以使用 `start transaction with consistent snapshot` 命令。

可重复读隔离级别下，事务在启动的时候就拍了个快照，注意，**这个快照是基于整库的**。快照的实现不是拷贝数据，否则，要是数据库上百 GB，开启个事务早就废了。

要知道的是，InnoDB 引擎中每个事务有一个唯一的事务 ID，叫做 transaction_id，他是在事务开始的时候向 InnoDB 事务系统申请的，并且按申请顺序严格递增。

而且每行也都是有多个版本的，每次事务更新数据的时候，都会生成一个新的数据版本，并且把 transaction_id 赋值给这个版本的事务 ID，记为 row trx_id。同时，旧的数据版本要保留，并且在新的数据版本中，要有信息能够拿到它。

我们再来看 MySQL 是如何快速创建一致性视图的，按照可重复读的定义，一个事务启动的时候，能够看到所有已经提交的事务结果，但是之后，其他事务的更新对它不可见。因此，一个事务只需要在启动的时候声明说，“以我启动的时刻为准，如果一个数据版本是在我启动之前生成的，就认；如果是我启动以后才生成的，我就不认，我必须要找到它的上一个版本”。当然，如果“上一个版本”也不可见，那就得继续往前找。还有，如果是这个事务自己更新的数据，它自己还是要认的。

在实现上， InnoDB 为每个事务构造了一个数组，用来保存这个事务启动瞬间，当前正在“活跃”的所有事务 ID。“活跃”指的就是，启动了但还没提交。数组里面事务 ID 的最小值记为低水位，当前系统里面已经创建过的事务 ID 的最大值加 1 记为高水位。这个视图数组和高水位，就组成了当前事务的一致性视图（read-view）。而数据版本的可见性规则，就是基于数据的 row trx_id 和这个一致性视图的对比结果得到的。

这个视图数组把所有的 row trx_id 分成了几种不同的情况。

![consistent-read](consistent-read.png)

这样，对于当前事务的启动瞬间来说，一个数据版本的 row trx_id，有以下几种可能：

1. 如果落在绿色部分，表示这个版本是已提交的事务或者是当前事务自己生成的，这个数据是可见的；
2. 如果落在红色部分，表示这个版本是由将来启动的事务生成的，是肯定不可见的；
3. 如果落在黄色部分，那就包括两种情况
    - 若 row trx_id 在数组中，表示这个版本是由还没提交的事务生成的，不可见；
    - 若 row trx_id 不在数组中，表示这个版本是已经提交了的事务生成的，可见。

InnoDB 利用了“所有数据都有多个版本”的这个特性，实现了“秒级创建快照”的能力。一个数据版本，对于一个事务视图来说，除了自己的更新总是可见之外，有三种情况：

1. 版本未提交，不可见；
2. 版本已提交，但是在视图创建后提交，不可见；
3. 版本已提交，而且视图创建前提交的，可见；

上面的规则仅仅是对于查询而言，但是对于更新，又是另一种情况了，请看下文，事务B的视图数组是先生成的，之后事务C才提交，不是应该看不见（1，2）吗，如何计算出（1，3）？

![consistent-update](consistent-update.png)

确实如此，如果这个事务更新之前查询一次数据，这个查询返回的k值确实是1，但是当要去更新数据的时候，就不能再在历史版本上更新了，否则事务C的更新就丢失了，因此，事务B此时的 set k=k+1 是在 （1,2）的基础上进行的操作。所以这里就用到了这样一条规则：**更新数据时先读后写的，而这个读，只能读当前的值，成为 “当前读”（current read）**。因此，在更新的时候，当前读拿到的数据时（1，2），更新后生成的数据是（1，3），这个新版本的 row trx_id 是101。所以，在执行事务 B 查询语句的时候，一看自己的版本号是 101，最新数据的版本号也是 101，是自己的更新，可以直接使用，所以查询得到的 k 的值是 3。这里我们提到了一个概念，叫作当前读。其实，除了 update 语句外，select 语句如果加锁，也是当前读。所以，如果把事务 A 的查询语句 select * from t where id=1 修改一下，加上 lock in share mode 或 for update，也都可以读到版本号是 101 的数据，返回的 k 的值是 3。下面这两个 select 语句，就是分别加了读锁（S 锁，共享锁）和写锁（X 锁，排他锁）。

    mysql> select k from t where id=1 lock in share mode;
    mysql> select k from t where id=1 for update;

可重复读的核心就是一致性读（consistent read）；而事务更新数据的时候，只能用当前读。如果当前的记录的行锁被其他事务占用的话，就需要进入锁等待。

而读提交的逻辑和可重复读的逻辑类似，它们最主要的区别是：

- 在可重复读隔离级别下，只需要在事务开始的时候创建一致性视图，之后事务里的其他查询都共用这个一致性视图；
- 在读提交隔离级别下，每一个语句执行前都会重新算出一个新的视图。

那么，我们再看一下，在读提交隔离级别下，事务 A 和事务 B 的查询语句查到的 k，分别应该是多少呢？这里需要说明一下，“start transaction with consistent snapshot; ”的意思是从这个语句开始，创建一个持续整个事务的一致性快照。所以，在读提交隔离级别下，这个用法就没意义了，等效于普通的 start transaction。

下面是读提交时的状态图，可以看到这两个查询语句的创建视图数组的时机发生了变化，就是图中的 read view 框。

![consistent-read-commit](consistent-read-commit.png)

这时，事务 A 的查询语句的视图数组是在执行这个语句的时候创建的，时序上 (1,2)、(1,3) 的生成时间都在创建这个视图数组的时刻之前。但是，在这个时刻：

- (1,3) 还没提交，属于情况 1，不可见；
- (1,2) 提交了，属于情况 3，可见。

### 什么是 change buffer？

[官方文档](https://dev.mysql.com/doc/refman/5.7/en/innodb-change-buffer.html)，当更新一个数据页的时候，如果数据页在内存中就直接更新，而如果这个数据没在内存中的话，在不影响数据一致性的前提下，InnoDB 会将这些更新操作缓存在 change buffer 中，这样就不需要从磁盘读入这个数据页了。在下次需要访问这个数据页的时候，将数据页读入内存，然后执行change buffer 中与这个页有关的操作，通过这种方式就能保证这个数据逻辑的正确性。需要说明的是，虽然名字叫 change buffer，实际上他也是可以持久化的数据，也就是说，change buffer 在内存中有拷贝，也会被写入到磁盘上。

将 change buffer 中数据应用到原数据页，得到最新结果的过程称为 merge。除了访问这个数据页会触发merge外，后台线程也会定期merge，在数据库正常关闭的过程中，也会执行 merge 操作。

change buffer 使用的是 buffer pool 中的内存，因此不能无限增大，change buffer 的大小通过参数 [innodb_change_buffer_max_size](https://dev.mysql.com/doc/refman/5.7/en/innodb-parameters.html#sysvar_innodb_change_buffer_max_size) 来动态设置。

将数据从磁盘读入内存设计到随机IO，是数据库里成本最高的操作之一。change buffer 因为减少了随机磁盘访问，所以对性能的提升是很明显的。

但是并不是 change buffer 在任何场景下都能起到加速的作用，因为 merge 的时候是真正记性数据更新的时刻，而 change buffer 的主要目的是将记录的变更动作缓存下来，所以在一个数据页做 merge 之前，change buffer 记录的变更越多，收益就越大。因此，对于血多读少的业务来说，页面写完之后马上被访问到的概率很小，此时 change buffer 的使用效果最好。

和 redo log 降低随机写磁盘消耗不同的是，change buffer 降低了随机读磁盘的消耗。

### 普通索引，唯一索引如何选？

就查询来说，影响可以忽略不计，例如对于查询语句：`select id from T where k = 5`，这个语句在索引树上查找的过程，先是通过 B+ 树从树根开始，按层搜索到叶子节点，然后可以再数据页内部通过二分法来定位记录：

- 对于普通索引来说，查找到满足条件的第一个记录之后，需要查找下一个记录，知道碰到第一个不满足条件的记录；

- 对于唯一索引来说，由于索引确定了唯一性，查找到第一个满足条件的记录之后，就会停止继续检索。

我们知道，InnoDB 是按照数据页为单位来读写的，也就是说，当需要读取一条记录的时候，并不是将这个记录本身从磁盘读出来，而是以页为单位，将其整体读入内存，在 InnoDB 中，每个数据页的大小默认是 16kb。因此，说是找到某条记录，其实这条记录所在的数据页被读进内存，那么，对于普通索引来说，要多做的仅仅是 “查找和判断下一条记录是不是满足条件”，仅仅是指针移动一下而已。

对于更新过程来说，由于唯一索引的约束，要插入一条记录的时候，首先要判断是否存在那条记录，所以务必要将数据页读入内存判断。如果都已经读入内存了，那直接更新内存会更快，就没有必要使用 change buffer了。因此，唯一索引无法用到change buffer，实际上，只有普通索引才能用到。

因此如果要在一张表中插入一条新记录的时候，可以分为两种情况。

第一种情况，要更新的数据页在内存中，这种情况下，两者没有什么差别：

- 唯一索引，判断要插入的位置有没有冲突，没有冲突，插入，结束；
- 普通索引，在要插入的位置插入数据，结束。

第二种情况，要更新的数据页不在内存中，处理如下：

- 唯一索引，需要将数据页读入内存，判断有没有冲突，没有，插入，语句执行结束；
- 普通索引，则是将记录更新到 change buffer ，结束。

### 怎么给字符串字段加索引？

对于这样一张表：

    mysql> create table SUser(
    ID bigint unsigned primary key,
    email varchar(64), 
    )engine=innodb; 

我们可能由这样的查询场景：

    mysql> select f1, f2 from SUser where email='xxx';

MySQL 是支持前缀索引的，也就是说对于字符串字段，我们可以索引一部分，也可以索引整个字段，索引一部分，索引树占用字节更小，但同时会增加扫描次数，索引整个字段，可以做到精确查询，但是浪费了一点空间。有没有两全其美的方式呢，是有的，其实只要选择好前缀的长度，尽可能保证前缀区分度更大，既可以自做到节省空间，也可以做到减少查询次数。我们可以用类似下面的方式检查不同前缀长度的区分度：

    mysql> select 
    count(distinct left(email,4)）as L4,
    count(distinct left(email,5)）as L5,
    count(distinct left(email,6)）as L6,
    count(distinct left(email,7)）as L7,
    from SUser;

还有一个因素要考虑的是，在需要返回这个前缀索引所在的字段时，使用前缀索引就无法使用覆盖索引优化了。对于字符串字段来说，我们还可以对这个字符串字段做一下处理再索引，例如：倒序，hash 之后再索引。

### 什么是脏页，InnoDB 什么时候刷脏页，如何配置刷脏页策略？

由于 InnoDB 采用 WAL 技术，为了减少随机写磁盘带来的开销，更新操作将会先写入 redo log，并且更新内存页，再在空闲的时间内存页中的内容写入磁盘，这个过程中内存页和磁盘数据不一致，这里的内存页就称为脏页，InnoDB 会在空闲的时间将脏页更新到磁盘，保证数据一致性。所以可能会发生这样的情况，平时执行很快的更新操作，其实就是在写内存和追加写日志，而有时候执行很慢，可能就是在刷脏页。

什么情况下引发 InnoDB 的刷脏页过程呢？

- redo log 写满，由于 redo log 是被配置一组文件，循环写，所以可能写满。这种场景是要尽量避免的，因为出现这个情况的时候，整个系统就不再接受更新了，所有的更新都会堵住。

- 内存不够用了，要先将脏页刷写到磁盘，这种情况是常态。InnoDB 采用缓冲池（buffer pool）管理内存，缓冲池中的内存页有三种状态，还没使用、使用了并且是干净页、使用了并且是脏页。InnoDB 的策略是尽量使用内存，因此对于一个长时间运行的库来说，未被使用的页面很少。而当要读入的数据页没有在内存的时候，就必须到缓冲池中申请一个数据页。这时候只能把最不使用的内存页从缓冲池淘汰掉，如果淘汰的是一个干净也，直接拿出来复用；如果是脏页，就必须先刷写磁盘，编程干净页后才能复用。所以，刷脏页是常态，但是一个查询要淘汰的脏页个数太多，或者日志写满，写性能会跌为0，这两种情况都会导致性能下降，影响业务。

- 系统空闲的时候；

- MySQL 正常关闭的时候；

如何配置脏页刷新策略？

首先需要正确告知 InnoDB 所在主机的 IO 能力，这样才能让 InnoDB  知道需要全力刷脏页的时候可以刷多块。[innodb_io_capacity](https://dev.mysql.com/doc/refman/5.7/en/innodb-parameters.html#sysvar_innodb_io_capacity) 用来配置磁盘能力，这个值应该设置成磁盘的 IOPS。磁盘的 IOPS 可以通过工具 [fio](https://github.com/axboe/fio) 来测试：

     fio -filename=$filename -direct=1 -iodepth 1 -thread -rw=randrw -ioengine=psync -bs=16k -size=500M -numjobs=10 -runtime=10 -group_reporting -name=mytest 

InnoDB 决定是否要刷脏页，是根据两个因素：脏页比例，redo log 写盘速度计算出刷脏页的速度，[innodb_max_dirty_pages_pct](https://dev.mysql.com/doc/refman/5.7/en/innodb-parameters.html#sysvar_innodb_max_dirty_pages_pct) 用来设置脏页比例上限, [innodb_flush_neighbors](https://dev.mysql.com/doc/refman/5.7/en/innodb-parameters.html#sysvar_innodb_flush_neighbors) 用于设置如果脏页的相邻页即使脏页，要不要刷这个相邻的脏页。

### 为什么删除数据之后，表文件大小不变，如何处理？

自 MySQL 5.6.6 开始，[innodb_file_per_table](https://dev.mysql.com/doc/refman/5.7/en/innodb-parameters.html#sysvar_innodb_file_per_table) 默认为 ON，意思设置一个表的数据单独存储在一个文件中。由于 InnoDB 默认是按照页存储和读取数据的，当我们使用 delete 语句删除之后，实际上只是将相应数据页的相应位置记为可复用，并没有将空间回收，这样就会造成数据页存在空洞，插入数据也会造成这种情况。

处理这种情况的方法就是：`alter table A engine=InnoDB` ，这个命令在自 5.6 引入 Online DDL 之后，按照如下流程执行：

- 建立一个临时文件，扫描表A主键的所有数据页；

- 用数据页中表A的记录生成B+树，存储到临时文件中；

- 生成临时文件的过程中，将所有对 A 的操作记录在一个日志文件 （row log）中；

- 临时文件生成后，将日志文件中的操作应用到临时文件，得到一个逻辑上与表A相同的数据文件；

- 用临时文件替换表A的数据文件。

由于日志文件记录和重放操作这个功能的存在，这个方案在重建表的过程中，允许对表A做增删改操作，这也就是 Online DDL 名字的来源；

对于被很大的表来说，这个操作很消耗 IO 和 CPU 资源，因为涉及到大量的数据拷贝，因此，如果是线上服务，你要很小心控制操作时间，为了安全操作，推荐使用 Github 开源 [gh-ost](https://github.com/github/gh-ost)。

### optimize table，alter table，analyze table 的区别？

- `alter table t engine = InnoDB` 在线重建表；

- `analyze table t` 只是对表的索引信息做重新统计，并没有修改数据，这个过程会加 MDL 读锁；

- `optimize table t` 等价于 `recreate + analyze`

### `count(*)` ?

不同于 `MyISAM` 引擎，InnoDB 没有吧一个表的行数存在磁盘上，所以对于 `select count(8) from t` 这样的操作来说，InnoDB 需要一行一行地从引擎中读出数据，然后计数。InnoDB 之所以不像 MyISAM 把这个数字保存在磁盘上，是由于 MVCC 的存在，InnoDB 也不知道现在数据表里面有多少条数据，如下图所示：

![count](count.png)

看上去傻傻的 MySQL 在执行 `count(*)` 的时候还是做了优化的，InnoDB 是索引组织表，主键索引树的叶子节点是数据，而普通索引树的叶子节点是主键值。所以，普通索引树比主键索引树小很多，对于 count(*) 这样的操作，遍历哪个索引树得到的结果逻辑上都是一样的。因此，MySQL 优化器会找到最小的那棵树来遍历。

虽然 `show table status` 也能返回表的行数，但是这个只是个统计信息，不准确，这也是 MySQL 优化器有时会选错索引的原因之一。

`count(pk_id)`，`count(1)`，`count(字段)`，`count(*)`？

- 对于主键id来说，InnoDB 引擎会遍历整张表，把每一行的 id 值都取出来，返回给 server 层。server 层拿到 id 后，判断是不可能为空的，就按行累加。

- 对于 `count(1)`，InnoDB 引擎遍历整张表，但不取值。server 层对于返回的每一行，放一个数字“1”进去，判断是不可能为空的，按行累加。

- 对于 `count(字段)`

    - 如果这个“字段”是定义为 not null 的话，一行行地从记录里面读出这个字段，判断不能为 null，按行累加；

    - 如果这个“字段”定义允许为 null，那么执行的时候，判断到有可能是 null，还要把值取出来再判断一下，不是 null 才累加。

- 对于 `count(*)`，例外，并不会把全部字段取出来，而是专门做了优化，不取值。count(*) 肯定不是 null，按行累加。


所以结论是：按照效率排序的话，count(字段)**<count(主键 id)<count(1)≈count(*)，所以我建议你，尽量使用 count(*)**。

### MySQL 怎么知道 binlog 是完整的?

一个事务的 binlog 是有完整格式的：statement 格式的 binlog，最后会有 COMMIT；row 格式的 binlog，最后会有一个 XID event。

### redo log 和 binlog 是怎么关联起来的?

它们有一个共同的数据字段，叫 XID。崩溃恢复的时候，会按顺序扫描 redo log：

- 如果碰到既有 prepare、又有 commit 的 redo log，就直接提交；

- 如果碰到只有 parepare、而没有 commit 的 redo log，就拿着 XID 去 binlog 找对应的事务。

处于 prepare 阶段的 redo log 加上完整 binlog，重启就能恢复，由于 binlog 已经写入，没法回滚，如果拿着这个binlog恢复数据，就会导致数据不一致，所以在出库上也应该提交这个事务。

### 什么是 Redo Log Buffer？

对于如下的事务：

    begin;
    insert into t1 ...
    insert into t2 ...
    commit;

这个事务要往两个表中插入记录，插入数据的过程中，生成的日志都得先保存起来，但又不能在还没 commit 的时候就直接写到 redo log 文件里。所以，redo log buffer 就是一块内存，用来先存 redo 日志的。也就是说，在执行第一个 insert 的时候，数据的内存被修改了，redo log buffer 也写入了日志。但是，真正把日志写到 redo log 文件（文件名是 ib_logfile+ 数字），是在执行 commit 语句的时候做的。

### Order By 是如何工作的，什么是 sort buffer，如何优化？

对于如下的表：
  
    CREATE TABLE `t` (
    `id` int(11) NOT NULL,
    `city` varchar(16) NOT NULL,
    `name` varchar(16) NOT NULL,
    `age` int(11) NOT NULL,
    `addr` varchar(128) DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `city` (`city`)
    ) ENGINE=InnoDB;

我们可能有这样的查询：

    select city,name,age from t where city='杭州' order by name limit 1000  ;

我们在使用 `explain` 查看这个语句的查询计划时，可能会在 `Extra` 字段看到诸如 `Using filesort` 的字样，表示的就是这个 SQL 需要排序，MySQL 会给每个线程分配一段内存用于排序，称为 `sort_buffer`，大小由参数 [`sort_buffer_size`](https://dev.mysql.com/doc/refman/5.7/en/server-system-variables.html#sysvar_sort_buffer_size) 控制。

通常情况下，这个语句的执行过程如下，暂且成为全字段排序：

1. 初始化 sort_buffer，确定放入 name、city、age 这三个字段；
2. 从索引 city 找到第一个满足 city='杭州’条件的主键 id，也就是图中的 ID_X；
3. 到主键 id 索引取出整行，取 name、city、age 三个字段的值，存入 sort_buffer 中；
4. 从索引 city 取下一个记录的主键 id；
5. 重复步骤 3、4 直到 city 的值不满足查询条件为止，对应的主键 id 也就是图中的 ID_Y；
6. 对 sort_buffer 中的数据按照字段 name 做快速排序；
7. 按照排序结果取前 1000 行返回给客户端。

如果排序的数据量很小，sort_buffer 可以容纳，那就直接在内存中排序，否则就需要在临时文件中排序了，临时文件中排序采用的归并排序算法。

但是如果要返回的字段很多的话，sort_buffer 中存放的字段多太多，这样内存能够同时放下的行数很少，要分成多个临时文件，排序的性能会很差。MySQL 在单行长度超过 [max_length_for_sort_data](https://dev.mysql.com/doc/refman/5.7/en/server-system-variables.html#sysvar_max_length_for_sort_data) 时会采取另外一种算法，为了避免分割成多个临时文件，降低排序效率，这个算法的执行流程如下，暂且成为 rowid 排序：

1. 初始化 sort_buffer，确定放入两个字段，即 name 和 id；
2. 从索引 city 找到第一个满足 city='杭州’条件的主键 id，也就是图中的 ID_X；
3. 到主键 id 索引取出整行，取 name、id 这两个字段，存入 sort_buffer 中；
4. 从索引 city 取下一个记录的主键 id；
5. 重复步骤 3、4 直到不满足 city='杭州’条件为止，也就是图中的 ID_Y；
6. 对 sort_buffer 中的数据按照字段 name 进行排序；
7. 遍历排序结果，取前 1000 行，并按照 id 的值回到原表中取出 city、name 和 age 三个字段返回给客户端。

之所要排序，是因为数据时无序的，那么可不可以利用索引树是有序存放这个原理，从而避免排序呢，答案是可以的？我们在这张表上建立一个 (city, name) 的联合索引，这样就不会在去排序，执行 explain，也不会看到需要排序的字样了：

    alter table t add index city_user(city, name);

这个时候语句执行逻辑就如下这个样子了：

1. 从索引 (city,name) 找到第一个满足 city='杭州’条件的主键 id；
2. 到主键 id 索引取出整行，取 name、city、age 三个字段的值，作为结果集的一部分直接返回；
3. 从索引 (city,name) 取下一个记录主键 id；
4. 重复步骤 2、3，直到查到第 1000 条记录，或者是不满足 city='杭州’条件时循环结束。

这个语句还需要字段 age，为了避免回表，我们可以创建这样一个联合索引：(city, name, age):

    alter table t add index city_user_age(city, name, age);

这个时候，语句的执行流程就如下：

1. 从索引 (city,name,age) 找到第一个满足 city='杭州’条件的记录，取出其中的 city、name 和 age 这三个字段的值，作为结果集的一部分直接返回；
2. 从索引 (city,name,age) 取下一个记录，同样取出这三个字段的值，作为结果集的一部分直接返回；
3. 重复执行步骤 2，直到查到第 1000 条记录，或者是不满足 city='杭州’条件时循环结束。

这个时候我们再去执行 explain，会看到 extra 字段有 `Using index`，表示使用了覆盖索引。

### `order by rand()` 是如何执行的？

对于下面这样一个语句，MySQL 是如何执行的：

    mysql> select word from words order by rand() limit 3;

1. 创建一个临时表。这个临时表使用的是 memory 引擎，表里有两个字段，第一个字段是 double 类型，为了后面描述方便，记为字段 R，第二个字段是 varchar(64) 类型，记为字段 W。并且，这个表没有建索引。

2. 从 words 表中，按主键顺序取出所有的 word 值。对于每一个 word 值，调用 rand() 函数生成一个大于 0 小于 1 的随机小数，并把这个随机小数和 word 分别存入临时表的 R 和 W 字段中，到此，扫描行数是 10000。

3. 现在临时表有 10000 行数据了，接下来你要在这个没有索引的内存临时表上，按照字段 R 排序。

4. 初始化 sort_buffer。sort_buffer 中有两个字段，一个是 double 类型，另一个是整型。

5. 从内存临时表中一行一行地取出 R 值和位置信息（我后面会和你解释这里为什么是“位置信息”），分别存入 sort_buffer 中的两个字段里。这个过程要对内存临时表做全表扫描，此时扫描行数增加 10000，变成了 20000。

6. 在 sort_buffer 中根据 R 的值进行排序。注意，这个过程没有涉及到表操作，所以不会增加扫描行数。

7. 排序完成后，取出前三个结果的位置信息，依次到内存临时表中取出 word 值，返回给客户端。

由于 memory 引擎不是索引组织表，其中的位置信息可以想象成数组下表。在 InnoDB 中，一个表如果没有主键，InnoDB 会自己生成一个长度为 6 字节的 rowid 作为主键，实际上就是每个引擎用来为唯一标识每一行数据的信息。

- 对于有主键的 InnoDB 表来说，这个 rowid 就是主键 ID；
- 对于没有主键的 InnoDB 表来说，这个 rowid 就是由系统生成的；
- MEMORY 引擎不是索引组织表。在这个例子里面，你可以认为它就是一个数组。因此，这个 rowid 其实就是数组的下标。

总结，**order by rand() 使用了内存临时表，内存临时表排序的时候使用了 rowid 排序方法。**

但是临时表是由大小限制的，由参数 [tmp_table_size](https://dev.mysql.com/doc/refman/5.7/en/server-system-variables.html#sysvar_tmp_table_size) 指定，默认 16MB，如果临时表大小超过了这个参数，那么内存临时表就会转成磁盘临时表，磁盘临时的使用默认引擎是 InnoDB ，这个由参数 [internal_tmp_disk_storage_engine](https://dev.mysql.com/doc/refman/5.7/en/server-system-variables.html#sysvar_internal_tmp_disk_storage_engine) 指定，5.7.6 以后默认为 InnoDB。

**order by rand() 这种写法会让计算过程非常复杂，需要扫描大量行数，因此排序过程中消耗的资源也很多，应该采取其他的方式实现**。

### 什么情况下会使索引失效？

对于如下的这张表：

    mysql> CREATE TABLE `tradelog` (
    `id` int(11) NOT NULL,
    `tradeid` varchar(32) DEFAULT NULL,
    `operator` int(11) DEFAULT NULL,
    `t_modified` datetime DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `tradeid` (`tradeid`),
    KEY `t_modified` (`t_modified`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    mysql> CREATE TABLE `trade_detail` (
    `id` int(11) NOT NULL,
    `tradeid` varchar(32) DEFAULT NULL,
    `trade_step` int(11) DEFAULT NULL, /* 操作步骤 */
    `step_info` varchar(32) DEFAULT NULL, /* 步骤信息 */
    PRIMARY KEY (`id`),
    KEY `tradeid` (`tradeid`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;



为何以下这两条语句用不到索引：

    mysql> select count(*) from tradelog where month(t_modified)=7;
    mysql> select * from tradelog where tradeid=110717;
    mysql> select d.* from tradelog l, trade_detail d where d.tradeid=l.tradeid and l.id=2;

因为在对索引字段做了函数操作，就用不到索引了，需要走全标扫描，第一个语句很明显用了 month 函数，第二个语句有个潜在的转换，实际上相当于:

    mysql> select * from tradelog where  CAST(tradid AS signed int) = 110717;

第三个一个隐士的字符编码转换：

    select d.* from tradelog l, trade_detail d where CONVERT(traideid USING utf8mb4)=l.tradeid and l.id=2;

所以总结为，**对索引字段做函数操作，会破坏索引值的有序性，因此优化器就决定放弃走树搜索功能，进而进行全表扫描**。

### 为什么有时候执行一条简单的 SQL 语句很慢？

首先当 SQL 语句执行很慢的时候，我们可以通过 `show processlist` 命令查看当前线程处于何种状态，主要有以下几个原因：

- 等 MDL 锁，线程 state 为 `Waiting for table metadata lock`，增删改查需要获取 MDL 读锁，如果此刻正在由某个线程更改表结构而没有释放表的 MDL 写锁，那么就需要等待；

- 等 flush，线程 state 为 `Waiting for table flush`，这个状态表示一个线程正要对表 t 做 flush 操作，MySQL 中对表做 flush 操作的用法，一般有以下两个：

        flush tables t with read lock;

        flush tables with read lock;

    通常情况下，这两个语句执行很快，所以出现这种状态的原因是，有一个 flush table命令被别的语句堵住了，然后它由堵住了我们的语句。

![等待flush](wait-flush.png)

- 等行锁，如果你要查询的这一行被别的事务锁住，那么也得等待：

![等行锁](wait-record-lock.png)

- 查询慢，扫描行数过多，或者在事务中，为了取得一致性读，需要进行大量的回滚操作，都会导致响应时间很长。

### 什么是幻读，如何解决幻读？

幻读是在可重复读隔离级别下发生的，指的是一个事务在前后两次查询同一个范围的时候，后一次查询看到了前一次查询没有看到的结果。为了解决幻读，InnoDB 引入了间隙锁，也就是说，不仅可以给行加锁，行与行之间的间隙也是可以加锁的，但是间隙锁不同于行锁，与间隙锁冲突的是往这个间隙插入一条记录这个操作，间隙锁之间不存在冲突关系。间隙锁和行锁合称为 next-key lock，每个 next-key lock 是前开后闭区间。不过间隙锁的引入，虽然解决了幻读问题，但同时锁住了更大的范围，进而影响并发度。

如果是在读提交隔离级别下，是没有间隙锁的，但同时为了解决可能出现的数据和日志不一致问题，需要把 binlog_format 格式设置成 row。

锁规则里面，包含了两个“原则”、两个“优化”和一个“bug”:

- 原则 1：加锁的基本单位是 next-key lock。希望你还记得，next-key lock 是前开后闭区间。

- 原则 2：查找过程中访问到的对象才会加锁。

- 优化 1：索引上的等值查询，给唯一索引加锁的时候，next-key lock 退化为行锁。

- 优化 2：索引上的等值查询，向右遍历时且最后一个值不满足等值条件的时候，next-key lock 退化为间隙锁。

- 一个 bug：唯一索引上的范围查询会访问到不满足条件的第一个值为止。


### 特殊情况下提高 MySQL 性能的办法？

面对短连接风暴，如果系统提示错误，`Too many connectyions` 就是说当前 Server 的连接数超过了 [`max_connections`](https://dev.mysql.com/doc/refman/5.7/en/server-system-variables.html#sysvar_max_connections) 的限制，紧急情况下可以调高此值的限制，但是虽然客户端可以连接成功，但是由于 CPU 资源有限，线程的请求无法得到执行，或者干掉那些长时间空闲的连接。

如果是查询慢，可以通过紧急添加索引的方式或者 query rewrite 的方式缓解。

### binlog 的三种格式？

 
### MyISAM 被替换为 InnoDB 的原因？

- 不支持事务；
- 不支持行锁；

### MariaDB 有哪些优势？

- 更改表结构的时候，可以设定获取 MDL 写锁的时间，避免因更改表结构而影响线上业务正常执行；


### 主备延迟发生的原因有哪些？

1. 从库加全局读锁，做逻辑备份，无法执行主库同步过来的 binlog，导致主备延迟。
2. 备库做逻辑备份期间，主库传过来需要修改表结构的语句，有序逻辑备份持有某张表的 MDL 读锁，从库无法获取写锁，进入等待，导致延迟。

### MySQL 参数设置建议

1. [`innodb_flush_log_at_trx_commit=1`](https://dev.mysql.com/doc/refman/5.7/en/innodb-parameters.html#sysvar_innodb_flush_log_at_trx_commit) 事务提交时，持久化 Redo Log 到磁盘；
2. [`sync_binlog=1`](https://dev.mysql.com/doc/refman/5.7/en/replication-options-binary-log.html#sysvar_sync_binlog) 每次事务的 binlog 也都持久化到磁盘；
3. [`autocommit=1`](https://dev.mysql.com/doc/refman/5.7/en/server-system-variables.html#sysvar_autocommit) 开启自动事务提交，需要事务的时候，手动开启。

