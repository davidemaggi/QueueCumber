using EasyNetQ.Management.Client;
using QueueCumber.Models;
using QueueCumber.Models.Entities;
using RabbitMQ.Client;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Channels;
using System.Threading.Tasks;

namespace QueueCumber.Drivers.RabbitMQ
{
    public partial class QueueCumberDriverRabbitMQ : IQueueCumberDriver
    {

        private readonly QueueCumberConnection _connection;
        private readonly Guid SessionId;
        private readonly IConnection _rabbitMQ;
        private readonly IModel _channel;

        private readonly ManagementClient _managementApi;

        public QueueCumberDriverRabbitMQ(QueueCumberConnection connection)
        {
            this._connection = connection;

            SessionId= Guid.NewGuid();

           
            _rabbitMQ = BuildConnection();
            _channel = _rabbitMQ.CreateModel();
            _managementApi = BuildManagement();


        }

        private ManagementClient BuildManagement() {



            if (_connection.AuthType == Enums.AuthType.Basic)
            {

                return new ManagementClient(new Uri(_connection.ApiUrl), _connection.Username, _connection.Password);



            }


            return null;


        }

        private IConnection BuildConnection() {

            var factory = new ConnectionFactory { HostName = _connection.Hostname };

            if (_connection.AuthType==Enums.AuthType.Basic) { 
            
                factory.UserName= _connection.Username;
                factory.Password= _connection.Password;


            }




            return  factory.CreateConnection();
           

        }


        public static IQueueCumberDriver Connect(QueueCumberConnection connection)
        {
            var ret = new QueueCumberDriverRabbitMQ(connection);



            return ret;
        }

        public void Disconnect()
        {
            throw new NotImplementedException();
        }

        public Enums.Drivers getDriver() => Enums.Drivers.RabbitMQ;

        public Guid getSessionId() => SessionId;

        public bool hasQueues() => true;

        public bool hasStreams() => true;

        public bool isConnected()=> throw new NotImplementedException();


        




    }
}
